import React, { useCallback, useEffect, useState } from "react"
import { View, Text, Pressable, ScrollView } from "react-native"
// import { Stack } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { useTranslation } from "react-i18next"
import { useThemeMode } from "../theme-context"
import { ThemedHeader } from "@/components/ThemedHeader"
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
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode();

  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0 as PlaybackSpeed)

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
      // Ensure speed matches player options exactly
      const normalized = SPEED_OPTIONS.includes(prefs.playbackSpeed as PlaybackSpeed)
        ? (prefs.playbackSpeed as PlaybackSpeed)
        : normalizeSpeed(prefs.playbackSpeed as number)
      setPlaybackSpeed(normalized)
    } catch (error) {
      console.error("Failed to load preferences:", error)
    }
  }, [])

  // Load preferences on mount
  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  const selectSpeed = async (speed: PlaybackSpeed) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setPlaybackSpeed(speed)
    // Auto-save when speed changes
    try {
      const prefs: LearningPreferences = {
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
    </>
  )
}
