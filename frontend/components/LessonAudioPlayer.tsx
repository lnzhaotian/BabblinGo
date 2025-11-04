import React, { useEffect, useRef, useState } from "react"
import { View, useColorScheme } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import SingleTrackPlayer, { type PlaybackSpeed } from "@/components/SingleTrackPlayer"

export type LessonAudioPlayerProps = {
  track?: { id: string; title: string; audioUrl: string } | null
  playerSpeed: PlaybackSpeed
  loopEnabled: boolean
  hasPrev: boolean
  hasNext: boolean
  onSpeedChange: (speed: PlaybackSpeed) => void
  onNavigate: (action: "prev" | "next") => void
  onFinish: () => boolean
}

export function LessonAudioPlayer({
  track,
  playerSpeed,
  loopEnabled,
  hasPrev,
  hasNext,
  onSpeedChange,
  onNavigate,
  onFinish,
}: LessonAudioPlayerProps) {
  const colorScheme = useColorScheme()
  const [themeMode, setThemeMode] = useState<string | null>(null)
  const [replaySignal, setReplaySignal] = useState(0)
  const lastTrackIdRef = useRef<string | null>(null)
  useEffect(() => {
    AsyncStorage.getItem("themeMode").then((mode) => setThemeMode(mode))
  }, [])
  const isDark = (themeMode === "dark") || (themeMode === "system" && colorScheme === "dark")

  useEffect(() => {
    const currentId = track?.id ?? null
    if (lastTrackIdRef.current !== currentId) {
      lastTrackIdRef.current = currentId
      setReplaySignal(0)
    }
  }, [track?.id])

  if (!track || !track.audioUrl) return null

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: isDark ? "#222" : "#eee",
        backgroundColor: isDark ? "#18181b" : "#fff",
        shadowColor: isDark ? "#000" : "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 16,
      }}
    >
      <SingleTrackPlayer
        key={track.id}
        track={{ id: track.id, title: track.title ?? "", audioUrl: track.audioUrl }}
        autoPlay
        speed={playerSpeed}
        loop={loopEnabled}
        hasPrev={hasPrev}
        hasNext={hasNext}
        debug={__DEV__}
        onSpeedChange={onSpeedChange}
        onNavigate={onNavigate}
        onFinish={() => {
          const advanced = onFinish()
          if (!advanced && loopEnabled) {
            setReplaySignal((prev) => prev + 1)
          }
        }}
        playSignal={replaySignal}
      />
    </View>
  )
}
