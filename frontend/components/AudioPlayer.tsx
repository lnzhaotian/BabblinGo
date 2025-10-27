import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import { useAudioPlayer, AudioSource } from "expo-audio"

export type AudioTrack = {
  id: string
  title: string
  audioUrl: string
}

export type PlaybackSpeed = 0.5 | 0.7 | 1.0 | 1.25 | 1.5 | 1.7 | 2.0

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.7, 1.0, 1.25, 1.5, 1.7, 2.0]

export type AudioPlayerProps = {
  tracks: AudioTrack[]
  autoPlay?: boolean
  loop?: boolean
  onTrackChange?: (index: number) => void
  onTrackEnd?: (index: number) => void
}

export type AudioPlayerHandle = {
  goToTrack: (index: number, autoPlay?: boolean) => void
  play: () => void
  pause: () => void
  setSpeed: (speed: PlaybackSpeed) => void
  getCurrentIndex: () => number
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { tracks, autoPlay = true, loop = true, onTrackChange, onTrackEnd },
  ref
) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoopEnabled, setIsLoopEnabled] = useState(loop)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0)

  const player = useAudioPlayer()
  const hasLoadedInitialTrack = useRef(false)

  const loadTrack = useCallback(
    (index: number, shouldAutoPlay = false) => {
      if (index < 0 || index >= tracks.length) return

      const track = tracks[index]
      try {
        player.replace({ uri: track.audioUrl } as AudioSource)
        setCurrentIndex(index)
        if (shouldAutoPlay) player.play()
        onTrackChange?.(index)
      } catch (e) {
        console.error("[AudioPlayer] Error loading track", e)
      }
    },
    [tracks, player, onTrackChange]
  )

  useImperativeHandle(
    ref,
    () => ({
      goToTrack: (index: number, autoPlayParam = true) => loadTrack(index, autoPlayParam),
      play: () => player.play(),
      pause: () => player.pause(),
      setSpeed: (speed: PlaybackSpeed) => setPlaybackSpeed(speed),
      getCurrentIndex: () => currentIndex,
    }),
    [loadTrack, player, currentIndex]
  )

  useEffect(() => {
    if (tracks.length > 0 && !hasLoadedInitialTrack.current) {
      hasLoadedInitialTrack.current = true
      loadTrack(0, autoPlay)
    }
  }, [tracks.length, autoPlay, loadTrack])

  useEffect(() => {
    player.setPlaybackRate(playbackSpeed)
  }, [player, playbackSpeed])

  useEffect(() => {
    const sub = player.addListener("playbackStatusUpdate", () => {
      const isPlaying = player.playing
      const currentTime = player.currentTime
      const duration = player.duration
      if (!isPlaying && currentTime > 0 && duration > 0) {
        const finished = duration - currentTime < 0.1
        if (finished) {
          onTrackEnd?.(currentIndex)
          const next = currentIndex + 1
          if (next < tracks.length) {
            loadTrack(next, true)
          } else if (isLoopEnabled) {
            loadTrack(0, true)
          }
        }
      }
    })
    return () => sub.remove()
  }, [player, currentIndex, tracks.length, isLoopEnabled, onTrackEnd, loadTrack])

  useEffect(() => {
    return () => {
      try {
        if (player.playing) player.pause()
      } catch {}
    }
  }, [player])

  const handlePlayPause = () => {
    if (player.playing) player.pause()
    else player.play()
  }
  const handleStop = () => {
    player.pause()
    player.seekTo(0)
  }
  const handlePrev = () => {
    const prev = currentIndex - 1
    if (prev >= 0) loadTrack(prev, true)
  }
  const handleNext = () => {
    const next = currentIndex + 1
    if (next < tracks.length) loadTrack(next, true)
    else if (isLoopEnabled) loadTrack(0, true)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }
  if (tracks.length === 0) return null
  const currentTrack = tracks[currentIndex]
  const duration = player.duration || 0
  const position = player.currentTime || 0
  const progress = duration > 0 ? position / duration : 0

  return (
    <View style={{ paddingVertical: 16 }}>
      {/* <Text style={{ marginBottom: 8, textAlign: "center", fontSize: 14, fontWeight: "500", color: "#111827" }} numberOfLines={1}>
        {currentTrack.title}
      </Text>

      <View style={{ marginBottom: 12 }}>
        <View style={{ height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: "#d1d5db" }}>
          <View style={{ height: "100%", width: `${progress * 100}%`, backgroundColor: "#6366f1" }} />
        </View>
        <View style={{ marginTop: 4, flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 12, color: "#6b7280" }}>{formatTime(position)}</Text>
          <Text style={{ fontSize: 12, color: "#6b7280" }}>{formatTime(duration)}</Text>
        </View>
      </View> */}

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Pressable onPress={handleStop} style={({ pressed }) => ({ borderRadius: 999, padding: 8, backgroundColor: pressed ? "#e5e7eb" : "transparent" })}>
          <MaterialIcons name="stop" size={24} color="#4b5563" />
        </Pressable>
        <Pressable
          onPress={handlePrev}
          disabled={currentIndex === 0}
          style={({ pressed }) => ({ borderRadius: 999, padding: 8, backgroundColor: pressed ? "#e5e7eb" : "transparent", opacity: currentIndex === 0 ? 0.4 : 1 })}
        >
          <MaterialIcons name="skip-previous" size={32} color="#4b5563" />
        </Pressable>
        <Pressable onPress={handlePlayPause} style={({ pressed }) => ({ borderRadius: 999, backgroundColor: "#6366f1", padding: 12, opacity: pressed ? 0.8 : 1 })}>
          <MaterialIcons name={player.playing ? "pause" : "play-arrow"} size={32} color="#fff" />
        </Pressable>
        <Pressable
          onPress={handleNext}
          disabled={currentIndex === tracks.length - 1 && !isLoopEnabled}
          style={({ pressed }) => ({ borderRadius: 999, padding: 8, backgroundColor: pressed ? "#e5e7eb" : "transparent", opacity: currentIndex === tracks.length - 1 && !isLoopEnabled ? 0.4 : 1 })}
        >
          <MaterialIcons name="skip-next" size={32} color="#4b5563" />
        </Pressable>
        <Pressable onPress={() => setIsLoopEnabled(!isLoopEnabled)} style={({ pressed }) => ({ borderRadius: 999, padding: 8, backgroundColor: pressed ? "#e5e7eb" : "transparent" })}>
          <MaterialIcons name="repeat" size={24} color={isLoopEnabled ? "#6366f1" : "#9ca3af"} />
        </Pressable>
      </View>

      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
        {/* <Text style={{ marginRight: 8, fontSize: 12, color: "#6b7280" }}>Speed:</Text> */}
        {SPEED_OPTIONS.map((speed) => (
          <Pressable
            key={speed}
            onPress={() => setPlaybackSpeed(speed)}
            style={({ pressed }) => ({ borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: playbackSpeed === speed ? "#6366f1" : pressed ? "#e5e7eb" : "#d1d5db" })}
          >
            <Text style={{ fontSize: 12, fontWeight: "500", color: playbackSpeed === speed ? "#fff" : "#374151" }}>{Number.isInteger(speed) ? `${speed.toFixed(0)}x` : `${speed.toFixed(1)}x`}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
})
