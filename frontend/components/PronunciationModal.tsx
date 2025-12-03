import React, { useEffect, useState, useCallback, useRef } from "react"
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native"
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from "@react-native-voice/voice"
import { useTranslation } from "react-i18next"
import { useThemeMode } from "@/app/theme-context"
import { calculatePronunciationScore } from "@/lib/scoring"
import { Ionicons } from "@expo/vector-icons"
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio"
import * as Haptics from "expo-haptics"

type PronunciationModalProps = {
  visible: boolean
  transcript: string
  language?: string
  onSuccess: () => void
  onFail: () => void
  onClose: () => void // User manually skips
}

export const PronunciationModal: React.FC<PronunciationModalProps> = ({
  visible,
  transcript,
  language = "en-US",
  onSuccess,
  onFail,
  onClose,
}) => {
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode()
  const isDark = colorScheme === "dark"

  const dingPlayer = useAudioPlayer(require("@/assets/audios/ding.mp3"), { updateInterval: 50 })
  const dingStatus = useAudioPlayerStatus(dingPlayer)
  const correctPlayer = useAudioPlayer(require("@/assets/audios/Correct.mp3"))
  const correctStatus = useAudioPlayerStatus(correctPlayer)

  const [status, setStatus] = useState<"listening" | "processing" | "success" | "fail">("listening")
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const spokenTextRef = useRef("")
  const silenceTimer = useRef<any>(null)
  const isProcessingRef = useRef(false)
  const waitingForDingRef = useRef(false)
  const waitingForCorrectRef = useRef(false)

  const processResult = useCallback((spoken: string) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current)
      silenceTimer.current = null
    }

    console.log("[PronunciationModal] Processing FINAL result:", spoken)
    
    const calculatedScore = calculatePronunciationScore(transcript, spoken)
    console.log("[PronunciationModal] Final Score:", calculatedScore)

    // Threshold can be adjusted. 
    // Increased to 80 to catch semantic errors (e.g. "banana" vs "apple") while allowing minor STT quirks.
    const PASS_THRESHOLD = 80 

    if (calculatedScore >= PASS_THRESHOLD) {
      setStatus("success")
      waitingForCorrectRef.current = true
      correctPlayer.seekTo(0)
      correctPlayer.play()

      // Safety fallback: if audio doesn't finish in 3s, proceed anyway
      setTimeout(() => {
        if (waitingForCorrectRef.current) {
          console.log("[PronunciationModal] Correct sound timeout, forcing success")
          waitingForCorrectRef.current = false
          onSuccess()
        }
      }, 3000)
    } else {
      setStatus("fail")
      // Two quick vibrations for failure
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setTimeout(() => {
        onFail()
      }, 2000)
    }
  }, [transcript, onFail, onSuccess, correctPlayer])

  // Watch for correct sound to finish
  useEffect(() => {
    if (waitingForCorrectRef.current && correctStatus?.didJustFinish) {
      console.log("[PronunciationModal] Correct sound finished")
      waitingForCorrectRef.current = false
      onSuccess()
    }
  }, [correctStatus, onSuccess])

  // Reset modal state when visibility changes
  useEffect(() => {
    if (!visible) {
      setShowModal(false)
      waitingForDingRef.current = false
      waitingForCorrectRef.current = false
    }
  }, [visible])

  const resetSilenceTimer = useCallback((duration = 1500) => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current)
    }
    
    // If no speech for duration, consider it done
    silenceTimer.current = setTimeout(() => {
      console.log("[PronunciationModal] Silence detected, stopping...")
      Voice.stop().catch(console.error)
      if (spokenTextRef.current) {
        processResult(spokenTextRef.current)
      }
    }, duration)
  }, [processResult])

  const onSpeechStart = useCallback((e: any) => {
    console.log("[PronunciationModal] Speech started event:", e)
    // Give user more time (5s) to start speaking after the ding
    resetSilenceTimer(5000)
  }, [resetSilenceTimer])

  const onSpeechEnd = useCallback((e: any) => {
    console.log("[PronunciationModal] Speech ended event:", e)
    // If the engine detects end of speech, we process what we have
    if (spokenTextRef.current) {
        processResult(spokenTextRef.current)
    }
  }, [processResult])

  const onSpeechResults = useCallback((e: SpeechResultsEvent) => {
    console.log("[PronunciationModal] Speech results event:", e)
    if (e.value && e.value.length > 0) {
      const spoken = e.value[0]
      spokenTextRef.current = spoken
      // Once they start speaking, use shorter timeout for pauses
      resetSilenceTimer(1500)
    }
  }, [resetSilenceTimer])

  const onSpeechPartialResults = useCallback((e: SpeechResultsEvent) => {
    console.log("[PronunciationModal] Speech partial results event:", e)
    if (e.value && e.value.length > 0) {
      spokenTextRef.current = e.value[0]
      // Once they start speaking, use shorter timeout for pauses
      resetSilenceTimer(1500)
    }
  }, [resetSilenceTimer])

  const onSpeechError = useCallback((e: SpeechErrorEvent) => {
    console.log("[PronunciationModal] Speech error event:", e)
    // If it's a "no match" or "speech timeout", we might want to let user try again manually
    // Code 1110 is also "No speech detected" on some iOS versions
    const isNoSpeech = e.error?.code === '7' || e.error?.code === '6' || e.error?.code === '1110' || e.error?.message?.includes('No speech')

    if (isNoSpeech) { 
        setError(t("pronunciation.noSpeech", { defaultValue: "Didn't catch that. Tap to try again." }))
    } else {
        setError(e.error?.message || t("pronunciation.unknownError", { defaultValue: "Unknown error" }))
    }
    // Always transition to fail state so we hide the listening UI
    setStatus("fail")
  }, [t])

  const startListening = useCallback(async () => {
    try {
      console.log("[PronunciationModal] Starting listening sequence...")
      setStatus("listening")
      setShowModal(false) // Hide modal initially while playing sound
      spokenTextRef.current = ""
      setError(null)
      isProcessingRef.current = false
      waitingForDingRef.current = true
      
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current)
        silenceTimer.current = null
      }

      // Reset voice engine state to ensure clean slate
      await Voice.stop().catch(() => {})
      await Voice.destroy().catch(() => {})
      
      // Play prompt sound
      dingPlayer.seekTo(0)
      dingPlayer.play()
      
      // Safety fallback for ding
      setTimeout(() => {
        if (waitingForDingRef.current) {
            console.log("[PronunciationModal] Ding timeout, forcing start")
            waitingForDingRef.current = false
            setShowModal(true)
            
            setAudioModeAsync({
              allowsRecording: true,
              playsInSilentMode: true,
            }).then(() => {
              Voice.start(language).catch(e => {
                  console.error("[PronunciationModal] Voice start error (timeout fallback):", e)
                  setError(t("pronunciation.micError", { defaultValue: "Failed to start microphone" }))
              })
            }).catch(e => {
              console.error("[PronunciationModal] Audio mode error (timeout fallback):", e)
            })
        }
      }, 1000) // 1 second timeout for ding
      
      // Provide haptic feedback to signal readiness
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

      // Voice.start will be triggered by the useEffect watching dingStatus
    } catch (e) {
      console.error("[PronunciationModal] Start error:", e)
      setError(t("pronunciation.micError", { defaultValue: "Failed to start microphone" }))
      setShowModal(true) // Show modal if error occurs so user sees it
    }
  }, [t, dingPlayer, language])

  // Watch for ding sound to finish before starting voice
  useEffect(() => {
    if (waitingForDingRef.current && dingStatus?.didJustFinish) {
      console.log("[PronunciationModal] Ding finished, showing modal and starting voice...")
      waitingForDingRef.current = false
      setShowModal(true) // Show modal now that sound is done
      
      if (!visible) {
        console.log("[PronunciationModal] Modal closed, aborting voice start")
        return
      }

      // Enable recording mode only after the sound has finished
      setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      }).then(() => {
        Voice.start(language).catch(e => {
          console.error("[PronunciationModal] Voice start error:", e)
          setError(t("pronunciation.micError", { defaultValue: "Failed to start microphone" }))
        })
      }).catch(e => {
        console.error("[PronunciationModal] Failed to set audio mode:", e)
        setError(t("pronunciation.micError", { defaultValue: "Failed to start microphone" }))
      })
    }
  }, [dingStatus, visible, language, t])

  const stopListening = useCallback(async () => {
    try {
      console.log("[PronunciationModal] Stopping listening...")
      waitingForDingRef.current = false
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current)
        silenceTimer.current = null
      }
      await Voice.stop()
      
      // Reset audio mode to playback only when we are done listening
      // This ensures the main video/audio player gets the correct audio session (Speaker vs Receiver)
      console.log("[PronunciationModal] Resetting audio mode to playback...")
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      })
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    if (visible) {
      Voice.onSpeechStart = onSpeechStart
      Voice.onSpeechEnd = onSpeechEnd
      Voice.onSpeechResults = onSpeechResults
      Voice.onSpeechPartialResults = onSpeechPartialResults
      Voice.onSpeechError = onSpeechError
      startListening()
    } else {
      stopListening()
      Voice.destroy().then(Voice.removeAllListeners)
    }

    return () => {
      Voice.destroy().then(Voice.removeAllListeners)
    }
  }, [visible, startListening, stopListening, onSpeechResults, onSpeechPartialResults, onSpeechError, onSpeechStart, onSpeechEnd])

  const handleManualRetry = () => {
    startListening()
  }

  const handleManualStop = useCallback(() => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current)
      silenceTimer.current = null
    }

    if (spokenTextRef.current) {
      // Manual stop means we take whatever we have as final
      Voice.stop().catch(console.error)
      processResult(spokenTextRef.current)
    } else {
      // If nothing spoken, just stop listening
      stopListening()
      setError(t("pronunciation.noSpeech", { defaultValue: "Didn't catch that. Tap to try again." }))
      setStatus("fail")
    }
  }, [processResult, stopListening, t])

  if (!visible) return null

  return (
    <Modal visible={showModal} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: isDark ? "#1e293b" : "#fff" }]}>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>
            {t("pronunciation.title", { defaultValue: "Your Turn!" })}
          </Text>

          <Text style={[styles.transcript, { color: isDark ? "#cbd5e1" : "#475569" }]}>
            {transcript}
          </Text>

          <View style={styles.statusContainer}>
            {status === "listening" && (
              <View style={styles.listeningState}>
                <View style={[styles.micCircle, { backgroundColor: "#3b82f6" }]}>
                    <Ionicons name="mic" size={40} color="#fff" />
                </View>
                <Text style={[styles.statusText, { color: isDark ? "#93c5fd" : "#3b82f6" }]}>
                  {t("pronunciation.listening", { defaultValue: "Listening..." })}
                </Text>
                
                <TouchableOpacity 
                  onPress={handleManualStop} 
                  style={[styles.retryButton, { backgroundColor: isDark ? "#374151" : "#e2e8f0", marginTop: 16 }]}
                >
                  <Text style={[styles.retryText, { color: isDark ? "#f3f4f6" : "#1f2937" }]}>
                    {t("pronunciation.done", { defaultValue: "Done" })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {status === "processing" && (
              <ActivityIndicator size="large" color="#3b82f6" />
            )}

            {status === "success" && (
              <View style={styles.resultState}>
                <Ionicons name="checkmark-circle" size={60} color="#22c55e" />
                <Text style={[styles.statusText, { color: isDark ? "#e2e8f0" : "#1f2937", marginTop: 16 }]}>
                  {t("pronunciation.goodJob", { defaultValue: "Good Job!" })}
                </Text>
              </View>
            )}

            {status === "fail" && (
              <View style={styles.resultState}>
                <Ionicons name="alert-circle" size={60} color="#ef4444" />
                <Text style={[styles.statusText, { color: isDark ? "#e2e8f0" : "#1f2937", marginTop: 16 }]}>
                  {t("pronunciation.tryAgain", { defaultValue: "Nice try" })}
                </Text>
              </View>
            )}
            
            {error && (
                 <View style={styles.resultState}>
                    <Text style={{color: '#ef4444', textAlign: 'center'}}>{error}</Text>
                    <TouchableOpacity onPress={handleManualRetry} style={styles.retryButton}>
                        <Text style={styles.retryText}>{t("pronunciation.retry", { defaultValue: "Tap to Retry" })}</Text>
                    </TouchableOpacity>
                 </View>
            )}
          </View>

        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  transcript: {
    fontSize: 24,
    textAlign: "center",
    marginBottom: 32,
    fontWeight: "700",
  },
  statusContainer: {
    minHeight: 150,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  listeningState: {
    alignItems: "center",
    gap: 16,
  },
  micCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  statusText: {
    fontSize: 16,
    fontWeight: "600",
  },
  resultState: {
    alignItems: "center",
    gap: 8,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: "800",
  },
  spokenText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 8,
  },
  retryButton: {
      marginTop: 10,
      padding: 10,
      backgroundColor: '#e2e8f0',
      borderRadius: 8
  },
  retryText: {
      fontWeight: '600'
  }
})
