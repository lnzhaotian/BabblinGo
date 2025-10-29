import React, { useState, useRef } from "react"
import { View, Text, Pressable, Modal, FlatList } from "react-native"
import { useTranslation } from "react-i18next"
import * as Haptics from "expo-haptics"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.7, 1.0, 1.3, 1.5, 1.7, 2.0]

type Props = {
  summary?: string | null
  sessionSeconds: number
  speed: PlaybackSpeed
  onSessionSecondsChange: (sec: number) => void
  onSpeedChange: (s: PlaybackSpeed) => void
  onStart: () => void
}

export function LessonLandingCard({ summary, sessionSeconds, speed, onSessionSecondsChange, onSpeedChange, onStart }: Props) {
  const { t, i18n } = useTranslation()
  const [lengthModalVisible, setLengthModalVisible] = useState(false)
  
  const selectedMinute = Math.floor(sessionSeconds / 60)
  const selectedSecond = sessionSeconds % 60
  const [selectedMinuteIndex, setSelectedMinuteIndex] = useState<number>(selectedMinute)
  const [selectedSecondIndex, setSelectedSecondIndex] = useState<number>(selectedSecond)
  const minuteHapticRef = useRef<number>(selectedMinute)
  const secondHapticRef = useRef<number>(selectedSecond)

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    const isChinese = i18n.language === 'zh'
    
    if (secs === 0) {
      return isChinese ? `${minutes}分` : `${minutes}m`
    }
    return isChinese ? `${minutes}分${secs}秒` : `${minutes}m ${secs}s`
  }

  const selectSpeed = async (s: PlaybackSpeed) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    onSpeedChange(s)
  }

  return (
    <>
      <View style={{ flex: 1, backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32, justifyContent: "center" }}>
        {!!summary && (
          <Text style={{ fontSize: 16, color: "#444", textAlign: "center", marginBottom: 24 }}>{summary}</Text>
        )}
        <View style={{ gap: 16, alignSelf: "center", width: "100%", maxWidth: 420 }}>
          {/* Session length */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: "#374151", fontWeight: "600", textAlign: "center" }}>
              {t("settings.learning.setSessionLength") || "Session length"}
            </Text>
            <Pressable
              onPress={() => {
                setSelectedMinuteIndex(selectedMinute)
                setSelectedSecondIndex(selectedSecond)
                minuteHapticRef.current = selectedMinute
                secondHapticRef.current = selectedSecond
                setLengthModalVisible(true)
              }}
              style={{ alignItems: "center" }}
            >
              <View style={{
                minWidth: 140,
                paddingVertical: 12,
                paddingHorizontal: 20,
                backgroundColor: "#eef2ff",
                borderRadius: 12,
                alignItems: "center",
              }}>
                <Text style={{ fontSize: 28, fontWeight: "700", color: "#6366f1" }}>
                  {formatTime(sessionSeconds)}
                </Text>
                <Text style={{ marginTop: 4, color: "#6b7280", fontSize: 12 }}>{t("common.tapToEdit") || "Tap to edit"}</Text>
              </View>
            </Pressable>
          </View>

          {/* Playback speed */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: "#374151", fontWeight: "600", textAlign: "center" }}>
              {t("settings.learning.setPlaybackSpeed") || "Playback speed"}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {SPEED_OPTIONS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => selectSpeed(s)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    backgroundColor: speed === s ? "#6366f1" : "#f3f4f6",
                    minWidth: 60,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "600",
                      color: speed === s ? "#fff" : "#374151",
                    }}
                  >
                    {s}×
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable onPress={onStart} style={({ pressed }) => ({ marginTop: 16, backgroundColor: "#6366f1", paddingVertical: 14, borderRadius: 10, opacity: pressed ? 0.9 : 1 })}>
            <Text style={{ color: "#fff", textAlign: "center", fontSize: 16, fontWeight: "700" }}>
              {t("lesson.startLearning") || "Start learning"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Duration wheel modal (borrowed from settings) */}
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
        }
        const onSecondChange = (val: number) => {
          secondHapticRef.current = val
          setSelectedSecondIndex(val)
          Haptics.selectionAsync().catch(() => {})
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
                  {t("settings.learning.sessionLength") || "Session length"}
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
                      // Apply to session only, don't persist to global settings
                      onSessionSecondsChange(selectedMinuteIndex * 60 + selectedSecondIndex)
                      setLengthModalVisible(false)
                    }}
                    style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#6366f1" }}
                  >
                    <Text style={{ fontWeight: "700", color: "#fff" }}>{t("common.done") || "Done"}</Text>
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
