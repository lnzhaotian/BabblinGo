import React from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import type { LessonCacheStatus } from "@/lib/cache-manager"

export type LessonHeaderControlsProps = {
  loopEnabled: boolean
  cachingInProgress: boolean
  cacheStatus: LessonCacheStatus
  onToggleLoop: () => void
  onOpenCacheMenu: () => void
}

export function LessonHeaderControls({
  loopEnabled,
  cachingInProgress,
  cacheStatus,
  onToggleLoop,
  onOpenCacheMenu,
}: LessonHeaderControlsProps) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {cachingInProgress ? (
        <View style={{ position: "absolute", right: 52, top: -6 }} pointerEvents="none">
          <ActivityIndicator size="small" color="#007aff" />
        </View>
      ) : null}
      <Pressable
        onPress={onToggleLoop}
        accessibilityLabel="Toggle loop"
        hitSlop={8}
        style={{ padding: 4, marginLeft: 8 }}
      >
        <MaterialIcons name="repeat" size={22} color={loopEnabled ? "#6366f1" : "#9ca3af"} />
      </Pressable>
      <Pressable
        onPress={onOpenCacheMenu}
        accessibilityLabel="Cache options"
        hitSlop={8}
        style={{ padding: 4, marginLeft: 8 }}
      >
        <MaterialIcons
          name={
            cacheStatus === "full"
              ? "cloud-done"
              : cacheStatus === "partial"
              ? "cloud-download"
              : "cloud-queue"
          }
          size={22}
          color={
            cacheStatus === "full"
              ? "#10b981"
              : cacheStatus === "partial"
              ? "#f59e0b"
              : "#9ca3af"
          }
        />
      </Pressable>
    </View>
  )
}
