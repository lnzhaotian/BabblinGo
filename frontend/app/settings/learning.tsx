import React, { useCallback, useEffect, useRef, useState } from "react"
import { View, Text, Pressable, ScrollView, FlatList, Modal } from "react-native"
// import { Stack } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { useTranslation } from "react-i18next"
import { useThemeMode } from "../theme-context"
import { ThemedHeader } from "../components/ThemedHeader"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"
import {
  loadLearningPreferences,
  saveLearningPreferences,
  type LearningPreferences,
} from "@/lib/session-manager"

// Keep speed options identical to the audio player
const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.7, 1.0, 1.3, 1.5, 1.7, 2.0]

/**
 * Learning preferences settings screen
 * Allows users to configure default session length and playback speed
 */
// Replaced by ThemedHeader

export default function LearningSettingsScreen() {
  const { t, i18n } = useTranslation()
  const { colorScheme } = useThemeMode();

  const [sessionLength, setSessionLength] = useState(600) // seconds
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0 as PlaybackSpeed)
  // const [loading, setLoading] = useState(true)
  // Wheel selection state (minutes/seconds) for sessionLength
  const [selectedMinuteIndex, setSelectedMinuteIndex] = useState<number>(10)
  const [selectedSecondIndex, setSelectedSecondIndex] = useState<number>(0)
  const minuteHapticRef = useRef<number>(10)
  const secondHapticRef = useRef<number>(0)
  const [lengthModalVisible, setLengthModalVisible] = useState(false)

  // Load preferences on mount (declared after loadPreferences)

  const normalizeSpeed = (s: number): PlaybackSpeed => {
    let best = SPEED_OPTIONS[0]
    let bestDiff = Math.abs(s - best)
    for (const v of SPEED_OPTIONS) {
      const d = Math.abs(s - v)
      if (d < bestDiff) {
        best = v
        bestDiff = d
      }
    }
    return best
  }

  const loadPreferences = useCallback(async () => {
    try {
      const prefs = await loadLearningPreferences()
      setSessionLength(prefs.sessionLength)
      // Ensure speed matches player options exactly
      const normalized = SPEED_OPTIONS.includes(prefs.playbackSpeed as PlaybackSpeed)
        ? (prefs.playbackSpeed as PlaybackSpeed)
        : normalizeSpeed(prefs.playbackSpeed as number)
      setPlaybackSpeed(normalized)
      // Initialize wheels from stored length
      const m = Math.max(0, Math.floor(prefs.sessionLength / 60)) % 60
      const s = Math.max(0, Math.floor(prefs.sessionLength % 60)) % 60
      setSelectedMinuteIndex(m)
      setSelectedSecondIndex(s)
      minuteHapticRef.current = m
      secondHapticRef.current = s
    } catch (error) {
      console.error("Failed to load preferences:", error)
    } finally {
      // setLoading(false)
    }
  }, [])

  // Load preferences on mount
  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  const savePreferences = async () => {
    try {
      const prefs: LearningPreferences = {
        sessionLength,
        playbackSpeed,
      }
      await saveLearningPreferences(prefs)
    } catch (error) {
      console.error("Failed to save preferences:", error)
    }
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    const isChinese = i18n.language === 'zh'
    
    if (secs === 0) {
      return isChinese ? `${minutes}分` : `${minutes}m`
    }
    return isChinese ? `${minutes}分${secs}秒` : `${minutes}m ${secs}s`
  }

  const selectSpeed = async (speed: PlaybackSpeed) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setPlaybackSpeed(speed)
    // Auto-save when speed changes
    try {
      const prefs: LearningPreferences = {
        sessionLength,
        playbackSpeed: speed,
      }
      await saveLearningPreferences(prefs)
    } catch (error) {
      console.error("Failed to save speed preference:", error)
    }
  }

  return (
    <>
      <ThemedHeader titleKey="settings.learning.title" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#f9fafb" }} edges={["bottom"]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 24 }}>

        {/* Session Length Section */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colorScheme === 'dark' ? '#fff' : "#111827" }}>
            {t("settings.learning.sessionLength") || "Default Session Length"}
          </Text>
          <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280" }}>
            {t("settings.learning.sessionLengthDesc") ||
              "How long you plan to study when starting a learning session"}
          </Text>
          <Pressable
            onPress={() => setLengthModalVisible(true)}
            style={{ alignItems: "center", marginTop: 8 }}
          >
            <View style={{
              minWidth: 140,
              paddingVertical: 12,
              paddingHorizontal: 20,
              backgroundColor: colorScheme === 'dark' ? '#312e81' : "#eef2ff",
              borderRadius: 12,
              alignItems: "center",
            }}>
              <Text style={{ fontSize: 28, fontWeight: "700", color: colorScheme === 'dark' ? '#fff' : "#6366f1" }}>
                {formatTime(selectedMinuteIndex * 60 + selectedSecondIndex)}
              </Text>
              <Text style={{ marginTop: 6, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280" }}>{t("common.tapToEdit") || "Tap to edit"}</Text>
            </View>
          </Pressable>
        </View>

        {/* Playback Speed Section */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colorScheme === 'dark' ? '#fff' : "#111827" }}>
            {t("settings.learning.playbackSpeed") || "Default Playback Speed"}
          </Text>
          <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280" }}>
            {t("settings.learning.playbackSpeedDesc") ||
              "Audio playback speed for learning sessions"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SPEED_OPTIONS.map((speed) => (
              <Pressable
                key={speed}
                onPress={() => selectSpeed(speed)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  backgroundColor: playbackSpeed === speed ? (colorScheme === 'dark' ? '#10b981' : '#10b981') : (colorScheme === 'dark' ? '#23232a' : '#f3f4f6'),
                  minWidth: 70,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: playbackSpeed === speed ? '#fff' : (colorScheme === 'dark' ? '#d1d5db' : '#374151'),
                  }}
                >
                  {speed}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>


        </ScrollView>
      </SafeAreaView>
      {/* Duration wheel modal */}
      {(() => {
        const ITEM_HEIGHT = 36
        const VISIBLE_ITEMS = 5
        const PAD = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT
        const CYCLES = 50
        const base = Math.floor(CYCLES / 2) * 60
        const fmt = (n: number) => String(n).padStart(2, "0")
        const minutesLoop = Array.from({ length: CYCLES * 60 }, (_, idx) => fmt(idx % 60))
        const secondsLoop = Array.from({ length: CYCLES * 60 }, (_, idx) => fmt(idx % 60))

        const onMinuteChange = (val: number) => {
          minuteHapticRef.current = val
          setSelectedMinuteIndex(val)
          Haptics.selectionAsync().catch(() => {})
          setSessionLength(val * 60 + selectedSecondIndex)
        }
        const onSecondChange = (val: number) => {
          secondHapticRef.current = val
          setSelectedSecondIndex(val)
          Haptics.selectionAsync().catch(() => {})
          setSessionLength(selectedMinuteIndex * 60 + val)
        }

        return (
          <Modal
            visible={lengthModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setLengthModalVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center", padding: 24 }}>
              <View style={{ width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: "700", textAlign: "center" }}>
                  {t("settings.learning.sessionLength") || "Default Session Length"}
                </Text>

                <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 }}>
                  {/* Minutes wheel */}
                  <View style={{ alignItems: "center" }}>
                    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width: 100, overflow: "hidden" }}>
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: ITEM_HEIGHT * (VISIBLE_ITEMS / 2) - ITEM_HEIGHT / 2,
                          height: ITEM_HEIGHT,
                          backgroundColor: "#eef2ff",
                          opacity: 0.6,
                          borderRadius: 8,
                        }}
                      />
                      <FlatList
                        data={minutesLoop}
                        keyExtractor={(_, i) => `m-${i}`}
                        initialScrollIndex={base + selectedMinuteIndex}
                        getItemLayout={(_, idx) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * idx, index: idx })}
                        showsVerticalScrollIndicator={false}
                        snapToInterval={ITEM_HEIGHT}
                        decelerationRate="fast"
                        contentContainerStyle={{ paddingVertical: PAD }}
                        scrollEventThrottle={16}
                        onScroll={(e) => {
                          const y = e.nativeEvent.contentOffset.y
                          const idx = Math.round(y / ITEM_HEIGHT)
                          const val = ((idx % 60) + 60) % 60
                          if (val !== minuteHapticRef.current) {
                            onMinuteChange(val)
                          }
                        }}
                        onMomentumScrollEnd={(e) => {
                          const y = e.nativeEvent.contentOffset.y
                          const idx = Math.round(y / ITEM_HEIGHT)
                          const val = ((idx % 60) + 60) % 60
                          onMinuteChange(val)
                        }}
                        renderItem={({ item, index }) => (
                          <View style={{ height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" }}>
                            <Text style={{ fontSize: 18, fontWeight: (index % 60) === selectedMinuteIndex ? "700" : "400", color: (index % 60) === selectedMinuteIndex ? "#111827" : "#9ca3af" }}>
                              {item}
                            </Text>
                          </View>
                        )}
                      />
                    </View>
                    <Text style={{ marginTop: 6, color: "#6b7280" }}>{t("timer.minutes") || "min"}</Text>
                  </View>

                  <View style={{ justifyContent: "center" }}>
                    <Text style={{ fontSize: 18, fontWeight: "700" }}>:</Text>
                  </View>

                  {/* Seconds wheel */}
                  <View style={{ alignItems: "center" }}>
                    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width: 100, overflow: "hidden" }}>
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: ITEM_HEIGHT * (VISIBLE_ITEMS / 2) - ITEM_HEIGHT / 2,
                          height: ITEM_HEIGHT,
                          backgroundColor: "#eef2ff",
                          opacity: 0.6,
                          borderRadius: 8,
                        }}
                      />
                      <FlatList
                        data={secondsLoop}
                        keyExtractor={(_, i) => `s-${i}`}
                        initialScrollIndex={base + selectedSecondIndex}
                        getItemLayout={(_, idx) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * idx, index: idx })}
                        showsVerticalScrollIndicator={false}
                        snapToInterval={ITEM_HEIGHT}
                        decelerationRate="fast"
                        contentContainerStyle={{ paddingVertical: PAD }}
                        scrollEventThrottle={16}
                        onScroll={(e) => {
                          const y = e.nativeEvent.contentOffset.y
                          const idx = Math.round(y / ITEM_HEIGHT)
                          const val = ((idx % 60) + 60) % 60
                          if (val !== secondHapticRef.current) {
                            onSecondChange(val)
                          }
                        }}
                        onMomentumScrollEnd={(e) => {
                          const y = e.nativeEvent.contentOffset.y
                          const idx = Math.round(y / ITEM_HEIGHT)
                          const val = ((idx % 60) + 60) % 60
                          onSecondChange(val)
                        }}
                        renderItem={({ item, index }) => (
                          <View style={{ height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" }}>
                            <Text style={{ fontSize: 18, fontWeight: (index % 60) === selectedSecondIndex ? "700" : "400", color: (index % 60) === selectedSecondIndex ? "#111827" : "#9ca3af" }}>
                              {item}
                            </Text>
                          </View>
                        )}
                      />
                    </View>
                    <Text style={{ marginTop: 6, color: "#6b7280" }}>{t("timer.seconds") || "sec"}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 12 }}>
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
                      // Save session length when closing modal
                      await savePreferences()
                      setLengthModalVisible(false)
                    }}
                    style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#6366f1" }}
                  >
                    <Text style={{ fontWeight: "700", color: "#fff" }}>{t("common.close") || "Close"}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )
      })()}
    </>
  )
}
