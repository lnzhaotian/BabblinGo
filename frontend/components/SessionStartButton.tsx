import React from "react"
import { View, Text, Pressable } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"

interface SessionStartButtonProps {
  // Preview mode props (when session is not active)
  sessionLength?: number // seconds
  playbackSpeed?: PlaybackSpeed
  onStart: () => void

  // Active mode props (when session is running)
  sessionActive: boolean
  sessionPaused?: boolean
  remainingSeconds?: number
  onPause?: () => void
  onResume?: () => void
  onStop?: () => void
}

/**
 * Session start/control button
 * - Preview mode: Shows session info and start button
 * - Active mode: Shows countdown timer with pause/resume/stop controls
 */
export const SessionStartButton: React.FC<SessionStartButtonProps> = ({
  sessionLength = 600,
  playbackSpeed = 1.0,
  onStart,
  sessionActive,
  sessionPaused = false,
  remainingSeconds = 0,
  onPause,
  onResume,
  onStop,
}) => {
  const { t } = useTranslation()

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const formatPreviewTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    return `${minutes} min`
  }

  // Active session view
  if (sessionActive) {
    return (
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: sessionPaused ? "#fef3c7" : "#dcfce7",
          borderBottomWidth: 1,
          borderBottomColor: sessionPaused ? "#fbbf24" : "#10b981",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {/* Timer Display */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <MaterialIcons
              name="timer"
              size={24}
              color={sessionPaused ? "#f59e0b" : "#10b981"}
            />
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: sessionPaused ? "#92400e" : "#065f46",
              }}
            >
              {formatTime(remainingSeconds)}
            </Text>
            {sessionPaused && (
              <Text style={{ fontSize: 12, color: "#92400e", fontWeight: "600" }}>
                {t("session.paused") || "PAUSED"}
              </Text>
            )}
          </View>

          {/* Controls */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {sessionPaused ? (
              <Pressable
                onPress={onResume}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: "#10b981",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <MaterialIcons name="play-arrow" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  {t("session.resume") || "Resume"}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={onPause}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 8,
                  backgroundColor: "#f59e0b",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <MaterialIcons name="pause" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  {t("session.pause") || "Pause"}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={onStop}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: "#ef4444",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MaterialIcons name="stop" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                {t("session.stop") || "Stop"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    )
  }

  // Preview/Start mode
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: "#eff6ff",
        borderBottomWidth: 1,
        borderBottomColor: "#3b82f6",
      }}
    >
      <Pressable
        onPress={onStart}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Session Info */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#3b82f6",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <MaterialIcons name="play-arrow" size={24} color="#fff" />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: "700", color: "#1e40af" }}>
              {t("session.startLearning") || "Start Learning Session"}
            </Text>
            <Text style={{ fontSize: 13, color: "#3b82f6" }}>
              {formatPreviewTime(sessionLength)} • {playbackSpeed}× {t("session.speed") || "speed"}
            </Text>
          </View>
        </View>

        {/* Start Arrow */}
        <MaterialIcons name="arrow-forward" size={24} color="#3b82f6" />
      </Pressable>
    </View>
  )
}
