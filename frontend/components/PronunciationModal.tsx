import React, { useEffect, useState, useCallback, useRef } from "react"
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native"
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from "@react-native-voice/voice"
import { useTranslation } from "react-i18next"
import { useThemeMode } from "@/app/theme-context"
import { calculatePronunciationScore } from "@/lib/scoring"
import { Ionicons } from "@expo/vector-icons"
import { setAudioModeAsync } from "expo-audio"

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

  const [status, setStatus] = useState<"listening" | "processing" | "success" | "fail">("listening")
  const [error, setError] = useState<string | null>(null)
  const spokenTextRef = useRef("")
  const silenceTimer = useRef<any>(null)
  const isProcessingRef = useRef(false)

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
    const PASS_THRESHOLD = 60 

    if (calculatedScore >= PASS_THRESHOLD) {
      setStatus("success")
      setTimeout(() => {
        onSuccess()
      }, 1500)
    } else {
      setStatus("fail")
      setTimeout(() => {
        onFail()
      }, 2000)
    }
  }, [transcript, onSuccess, onFail])

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current)
    }
    
    // If no speech for 1.5 seconds, consider it done
    silenceTimer.current = setTimeout(() => {
      console.log("[PronunciationModal] Silence detected, stopping...")
      Voice.stop().catch(console.error)
      if (spokenTextRef.current) {
        processResult(spokenTextRef.current)
      }
    }, 1500)
  }, [processResult])

  const onSpeechStart = useCallback((e: any) => {
    console.log("[PronunciationModal] Speech started event:", e)
    resetSilenceTimer()
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
      resetSilenceTimer()
    }
  }, [resetSilenceTimer])

  const onSpeechPartialResults = useCallback((e: SpeechResultsEvent) => {
    console.log("[PronunciationModal] Speech partial results event:", e)
    if (e.value && e.value.length > 0) {
      spokenTextRef.current = e.value[0]
      resetSilenceTimer()
    }
  }, [resetSilenceTimer])

  const onSpeechError = useCallback((e: SpeechErrorEvent) => {
    console.log("[PronunciationModal] Speech error event:", e)
    // If it's a "no match" or "speech timeout", we might want to let user try again manually
    if (e.error?.code === '7' || e.error?.code === '6') { // 7=NoMatch, 6=NoSpeech
        setError(t("pronunciation.noSpeech", { defaultValue: "Didn't catch that. Tap to try again." }))
        setStatus("fail")
    } else {
        setError(e.error?.message || t("pronunciation.unknownError", { defaultValue: "Unknown error" }))
    }
  }, [t])

  const startListening = useCallback(async () => {
    try {
      console.log("[PronunciationModal] Starting listening sequence...")
      setStatus("listening")
      spokenTextRef.current = ""
      setError(null)
      isProcessingRef.current = false
      
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current)
        silenceTimer.current = null
      }
      
      // Ensure audio session is ready for recording
      console.log("[PronunciationModal] Setting audio mode...")
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      })
      
      // Small delay to ensure audio session switch is complete
      await new Promise(resolve => setTimeout(resolve, 100))

      console.log("[PronunciationModal] Calling Voice.start...")
      await Voice.start(language)
      console.log("[PronunciationModal] Voice.start called")
    } catch (e) {
      console.error("[PronunciationModal] Start error:", e)
      setError(t("pronunciation.micError", { defaultValue: "Failed to start microphone" }))
    }
  }, [language, t])

  const stopListening = useCallback(async () => {
    try {
      console.log("[PronunciationModal] Stopping listening...")
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current)
        silenceTimer.current = null
      }
      await Voice.stop()
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
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: isDark ? "#1e293b" : "#fff" }]}>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
          </TouchableOpacity>

          <Text style={[styles.title, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>
            {t("pronunciation.title", { defaultValue: "Your Turn!" })}
          </Text>

          <Text style={[styles.transcript, { color: isDark ? "#cbd5e1" : "#475569" }]}>
            &quot;{transcript}&quot;
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
                  {t("pronunciation.tryAgain", { defaultValue: "Let's try again..." })}
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
    fontSize: 18,
    textAlign: "center",
    marginBottom: 32,
    fontStyle: "italic",
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
