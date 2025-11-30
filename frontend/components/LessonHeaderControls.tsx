import React, { useEffect, useRef } from "react"
import { View, Pressable, Animated, Easing } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import type { LessonCacheStatus } from "@/lib/cache-manager"

export type LessonHeaderControlsProps = {
  loopEnabled: boolean
  cachingInProgress: boolean
  cacheStatus: LessonCacheStatus
  onToggleLoop: () => void
  onOpenCacheMenu: () => void
  showLoopToggle?: boolean
  practiceModeEnabled?: boolean
  onTogglePracticeMode?: () => void
  showPracticeToggle?: boolean
}

export function LessonHeaderControls({
  loopEnabled,
  cachingInProgress,
  cacheStatus,
  onToggleLoop,
  onOpenCacheMenu,
  showLoopToggle = true,
  practiceModeEnabled = false,
  onTogglePracticeMode,
  showPracticeToggle = false,
}: LessonHeaderControlsProps) {
  const pulseValue = useRef(new Animated.Value(1)).current
  const activeAnimation = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (cachingInProgress && cacheStatus !== "full") {
      activeAnimation.current?.stop()
      pulseValue.setValue(1)
      activeAnimation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.15,
            duration: 450,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: 450,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      )
      activeAnimation.current.start()
    } else {
      activeAnimation.current?.stop()
      pulseValue.stopAnimation(() => pulseValue.setValue(1))
    }

    return () => {
      activeAnimation.current?.stop()
    }
  }, [cachingInProgress, cacheStatus, pulseValue])

  const iconName =
    cacheStatus === "full"
      ? "cloud-done"
      : cachingInProgress
      ? "cloud-download"
      : cacheStatus === "partial"
      ? "cloud-download"
      : "cloud-queue"

  const iconColor =
    cacheStatus === "full"
      ? "#10b981"
      : cachingInProgress
      ? "#3b82f6"
      : cacheStatus === "partial"
      ? "#f59e0b"
      : "#9ca3af"

  const animatedStyle =
    cachingInProgress && cacheStatus !== "full"
      ? {
          transform: [{ scale: pulseValue }],
        }
      : undefined

  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: showLoopToggle ? "flex-start" : "center", minWidth: showLoopToggle ? undefined : 44 }}>
      {showPracticeToggle && onTogglePracticeMode ? (
        <Pressable
          onPress={onTogglePracticeMode}
          accessibilityLabel="Toggle practice mode"
          hitSlop={8}
          style={{ padding: 4, marginLeft: 8 }}
        >
          <MaterialIcons name="mic" size={22} color={practiceModeEnabled ? "#ef4444" : "#9ca3af"} />
        </Pressable>
      ) : null}
      {showLoopToggle ? (
        <Pressable
          onPress={onToggleLoop}
          accessibilityLabel="Toggle loop"
          hitSlop={8}
          style={{ padding: 4, marginLeft: 8 }}
        >
          <MaterialIcons name="repeat" size={22} color={loopEnabled ? "#6366f1" : "#9ca3af"} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onOpenCacheMenu}
        accessibilityLabel="Cache options"
        hitSlop={8}
        style={{ padding: 4, marginLeft: showLoopToggle ? 8 : 0 }}
      >
        <Animated.View style={animatedStyle}>
          <MaterialIcons name={iconName} size={22} color={iconColor} />
        </Animated.View>
      </Pressable>
    </View>
  )
}
