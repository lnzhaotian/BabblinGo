import React, { useCallback, useEffect, useState } from "react"
import { View, Text, Pressable, ScrollView, Switch } from "react-native"
// import { Stack } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import * as Haptics from "expo-haptics"
import { useTranslation } from "react-i18next"
import { useThemeMode } from "../theme-context"
import { usePreferences } from "@/lib/preferences-context"
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
  const { globalTrackingEnabled, setGlobalTrackingEnabled } = usePreferences();

  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0 as PlaybackSpeed)
  const [defaultMode, setDefaultMode] = useState<"listen-only" | "listen-and-repeat">("listen-only")
  const [maxAttempts, setMaxAttempts] = useState<number>(3)

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
      setDefaultMode(prefs.defaultLearningMode)
      setMaxAttempts(prefs.maxAttempts ?? 3)
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
        defaultLearningMode: defaultMode,
        maxAttempts: maxAttempts,
      }
      await saveLearningPreferences(prefs)
    } catch (error) {
      console.error("Failed to save speed preference:", error)
    }
  }

  const selectMode = async (mode: "listen-only" | "listen-and-repeat") => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setDefaultMode(mode)
    try {
      const prefs: LearningPreferences = {
        playbackSpeed: playbackSpeed,
        defaultLearningMode: mode,
        maxAttempts: maxAttempts,
      }
      await saveLearningPreferences(prefs)
    } catch (error) {
      console.error("Failed to save mode preference:", error)
    }
  }

  const selectMaxAttempts = async (attempts: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setMaxAttempts(attempts)
    try {
      const prefs: LearningPreferences = {
        playbackSpeed: playbackSpeed,
        defaultLearningMode: defaultMode,
        maxAttempts: attempts,
      }
      await saveLearningPreferences(prefs)
    } catch (error) {
      console.error("Failed to save max attempts preference:", error)
    }
  }

  return (
    <>
      <ThemedHeader titleKey="settings.learning.title" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#f9fafb" }} edges={["bottom"]}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 24 }}>

        {/* Privacy Section */}
        <View style={{ gap: 12, display: 'none' }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colorScheme === 'dark' ? '#fff' : "#111827" }}>
            {t("settings.privacy")}
          </Text>
          <View style={{
            backgroundColor: colorScheme === 'dark' ? '#27272a' : '#fff',
            borderRadius: 12,
            padding: 16,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colorScheme === 'dark' ? '#fff' : '#111827' }}>
                {t('settings.trackingEnabled')}
              </Text>
              <Switch
                value={globalTrackingEnabled}
                onValueChange={setGlobalTrackingEnabled}
                trackColor={{ false: "#767577", true: "#6366f1" }}
                thumbColor={globalTrackingEnabled ? "#fff" : "#f4f3f4"}
              />
            </View>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : '#6b7280', lineHeight: 20 }}>
              {t('settings.trackingDescription')}
            </Text>
          </View>
        </View>

        {/* Default Learning Mode Section */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colorScheme === 'dark' ? '#fff' : "#111827" }}>
            {t("settings.learning.defaultMode")}
          </Text>
          <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280" }}>
            {t("settings.learning.defaultModeDesc")}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={() => selectMode("listen-only")}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: defaultMode === "listen-only" ? (colorScheme === 'dark' ? '#10b981' : '#10b981') : (colorScheme === 'dark' ? '#23232a' : '#f3f4f6'),
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: defaultMode === "listen-only" ? '#fff' : (colorScheme === 'dark' ? '#d1d5db' : '#374151'),
                }}
              >
                {t("settings.learning.modeListenOnly")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => selectMode("listen-and-repeat")}
              style={{
                flex: 1,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: defaultMode === "listen-and-repeat" ? (colorScheme === 'dark' ? '#10b981' : '#10b981') : (colorScheme === 'dark' ? '#23232a' : '#f3f4f6'),
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: defaultMode === "listen-and-repeat" ? '#fff' : (colorScheme === 'dark' ? '#d1d5db' : '#374151'),
                }}
              >
                {t("settings.learning.modeListenRepeat")}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Max Attempts Section */}
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colorScheme === 'dark' ? '#fff' : "#111827" }}>
            {t("settings.learning.maxAttempts") || "Practice Attempts"}
          </Text>
          <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280" }}>
            {t("settings.learning.maxAttemptsDesc") || "Maximum attempts allowed for each sentence"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((count) => (
              <Pressable
                key={count}
                onPress={() => selectMaxAttempts(count)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 20,
                  borderRadius: 8,
                  backgroundColor: maxAttempts === count ? (colorScheme === 'dark' ? '#10b981' : '#10b981') : (colorScheme === 'dark' ? '#23232a' : '#f3f4f6'),
                  minWidth: 50,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: maxAttempts === count ? '#fff' : (colorScheme === 'dark' ? '#d1d5db' : '#374151'),
                  }}
                >
                  {count}
                </Text>
              </Pressable>
            ))}
          </View>
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
    </>
  )
}
