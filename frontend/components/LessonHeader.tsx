import React from "react"
import { View, Text, Pressable, ActivityIndicator } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import type { LessonCacheStatus } from "@/lib/cache-manager"

interface LessonHeaderProps {
  title: string
  onBack: () => void
  cachingInProgress: boolean
  timerActive: boolean
  timerPaused: boolean
  remainingSeconds: number
  onTimerPress: () => void
  formatCountdown: (seconds: number) => string
  loopEnabled: boolean
  onToggleLoop: () => void
  lessonCacheStatus: LessonCacheStatus
  onCachePress: () => void
}

export const LessonHeader: React.FC<LessonHeaderProps> = ({
  title,
  onBack,
  cachingInProgress,
  timerActive,
  remainingSeconds,
  onTimerPress,
  formatCountdown,
  loopEnabled,
  onToggleLoop,
  lessonCacheStatus,
  onCachePress,
}) => {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
      }}
    >
      <Pressable
        onPress={onBack}
        accessibilityLabel="Back"
        style={{ padding: 4, marginRight: 8 }}
        hitSlop={8}
      >
        <MaterialIcons name="arrow-back" size={26} color="#007aff" />
      </Pressable>
      <Text
        style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" }}
        numberOfLines={1}
      >
        {title}
      </Text>
      {/* Cache indicator */}
      {cachingInProgress && (
        <View style={{ marginLeft: 8 }}>
          <ActivityIndicator size="small" color="#007aff" />
        </View>
      )}
      {/* Timer button + countdown */}
      <Pressable
        onPress={onTimerPress}
        accessibilityLabel="Set session timer"
        hitSlop={8}
        style={{
          padding: 4,
          marginLeft: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <MaterialIcons
          name="timer"
          size={22}
          color={timerActive ? "#16a34a" : "#9ca3af"}
        />
        {timerActive ? (
          <Text style={{ fontSize: 14, color: "#16a34a", fontWeight: "700" }}>
            {formatCountdown(remainingSeconds)}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        onPress={onToggleLoop}
        accessibilityLabel="Toggle loop"
        hitSlop={8}
        style={{ padding: 4, marginLeft: 8 }}
      >
        <MaterialIcons
          name="repeat"
          size={22}
          color={loopEnabled ? "#6366f1" : "#9ca3af"}
        />
      </Pressable>
      {/* Cache status button */}
      <Pressable
        onPress={onCachePress}
        accessibilityLabel="Cache options"
        hitSlop={8}
        style={{ padding: 4, marginLeft: 8 }}
      >
        <MaterialIcons
          name={
            lessonCacheStatus === "full"
              ? "cloud-done"
              : lessonCacheStatus === "partial"
                ? "cloud-download"
                : "cloud-queue"
          }
          size={22}
          color={
            lessonCacheStatus === "full"
              ? "#10b981"
              : lessonCacheStatus === "partial"
                ? "#f59e0b"
                : "#9ca3af"
          }
        />
      </Pressable>
    </View>
  )
}
