import React, { useEffect, useRef, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import { useAudioPlayer, useAudioPlayerStatus, AudioSource, setAudioModeAsync } from "expo-audio"

export type PlaybackSpeed = 0.5 | 0.7 | 1.0 | 1.25 | 1.5 | 1.7 | 2.0
const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.7, 1.0, 1.25, 1.5, 1.7, 2.0]

export type SingleTrack = {
  id: string
  title?: string
  audioUrl: string
}

export type SingleTrackPlayerProps = {
  track: SingleTrack
  autoPlay?: boolean
  speed: PlaybackSpeed  // Now controlled by parent
  loop: boolean  // Read-only from parent
  debug?: boolean
  hasPrev?: boolean
  hasNext?: boolean
  onSpeedChange?: (speed: PlaybackSpeed) => void
  onFinish?: () => void
  onNavigate?: (action: 'prev' | 'next') => void
}

export default function SingleTrackPlayer({ track, autoPlay = true, speed, loop, debug = false, hasPrev = false, hasNext = false, onSpeedChange, onFinish, onNavigate }: SingleTrackPlayerProps) {
  const DEBUG = !!debug
  const player = useAudioPlayer(undefined, { updateInterval: 250, downloadFirst: true })
  const status = useAudioPlayerStatus(player)
  const [isPlaying, setIsPlaying] = useState(false)
  const sessionIdRef = useRef<string>(Math.random().toString(36).slice(2))
  const mountedRef = useRef(true)
  const hasStartedRef = useRef(false)
  const hasCalledFinishRef = useRef(false)
  const lastProgressLogAt = useRef<number>(0)

  // Configure audio mode (iOS silent switch)
  useEffect(() => {
    (async () => {
      try { await setAudioModeAsync({ playsInSilentMode: true }) } catch {}
    })()
  }, [])

  // Load and (optionally) play on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Reset
        hasStartedRef.current = false
        hasCalledFinishRef.current = false
        setIsPlaying(false)
        try { await player.pause() } catch {}

        if (DEBUG) console.log(`[SingleTrack#${sessionIdRef.current}] Loading: ${track.title || track.id}`)
        await player.replace({ uri: track.audioUrl } as AudioSource)
        if (cancelled || !mountedRef.current) return
        await player.setPlaybackRate(speed)
        try { await player.seekTo(0) } catch {}
        if (cancelled || !mountedRef.current) return

        if (autoPlay) {
          try {
            await player.play()
            hasStartedRef.current = true
            setIsPlaying(true)
            if (DEBUG) console.log(`[SingleTrack#${sessionIdRef.current}] Started`)
          } catch (err) {
            console.error(`[SingleTrack#${sessionIdRef.current}] play() failed`, err)
          }
        }
      } catch (e) {
        // Silently ignore disposed player errors (happens when unmounting during load)
        if (cancelled || !mountedRef.current) return
        console.error(`[SingleTrack#${sessionIdRef.current}] Load error`, e)
      }
    })()
    return () => { cancelled = true }
    // We rely on parent to remount when track changes (via key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Apply rate changes on the fly
  useEffect(() => {
    ;(async () => {
      try {
        await player.setPlaybackRate(speed)
        if (isPlaying) await player.play()
      } catch {}
    })()
  }, [player, speed, isPlaying])

  // Keep UI in sync and detect finish
  useEffect(() => {
    if (typeof status?.playing === 'boolean') setIsPlaying(status.playing)

    if (DEBUG && status?.duration > 0 && status?.currentTime >= 0) {
      if (status.currentTime - (lastProgressLogAt.current || 0) >= 2) {
        lastProgressLogAt.current = status.currentTime
        console.log(`[SingleTrack#${sessionIdRef.current}] Progress: ${status.currentTime.toFixed(2)} / ${status.duration.toFixed(2)}, playing=${status.playing}`)
      }
    }

    // Preferred finish signal
    if (status?.didJustFinish) {
      if (!hasCalledFinishRef.current) {
        hasCalledFinishRef.current = true
        if (DEBUG) console.log(`[SingleTrack#${sessionIdRef.current}] Finished (didJustFinish)`)
        onFinish?.()
      }
    }

    // Backup: near-end idle
    if (status && status.duration > 0) {
      const timeRemaining = status.duration - status.currentTime
      if (!status.playing && (timeRemaining <= 1.0 || status.currentTime / status.duration >= 0.985)) {
        if (!hasCalledFinishRef.current) {
          hasCalledFinishRef.current = true
          if (DEBUG) console.log(`[SingleTrack#${sessionIdRef.current}] Finished (near-end idle)`) 
          onFinish?.()
        }
      }
    }
  }, [status, DEBUG, onFinish])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      try { if (player.playing) player.pause() } catch {}
    }
  }, [player])

  const handlePlayPause = async () => {
    try {
      if (player.playing) {
        await player.pause()
        setIsPlaying(false)
      } else {
        // If at end, seek to start before playing
        if (status && status.duration > 0 && status.currentTime >= status.duration - 0.5) {
          await player.seekTo(0)
          hasCalledFinishRef.current = false
        }
        try { await player.setPlaybackRate(speed) } catch {}
        await player.play()
        setIsPlaying(true)
      }
    } catch (e) {
      console.error(`[SingleTrack#${sessionIdRef.current}] Play/Pause error`, e)
    }
  }

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Pressable
          onPress={() => {
            const canNavigate = hasPrev || loop
            if (!canNavigate) return
            onNavigate?.('prev')
          }}
          disabled={!hasPrev && !loop}
          style={({ pressed }) => ({ borderRadius: 999, padding: 8, backgroundColor: pressed ? "#e5e7eb" : "transparent", opacity: (!hasPrev && !loop) ? 0.4 : 1 })}
        >
          <MaterialIcons name="skip-previous" size={32} color="#4b5563" />
        </Pressable>
        <Pressable
          onPress={handlePlayPause}
          style={({ pressed }) => ({ borderRadius: 999, backgroundColor: "#6366f1", padding: 12, opacity: pressed ? 0.8 : 1 })}
        >
          <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={32} color="#fff" />
        </Pressable>
        <Pressable
          onPress={() => {
            const canNavigate = hasNext || loop
            if (!canNavigate) return
            onNavigate?.('next')
          }}
          disabled={!hasNext && !loop}
          style={({ pressed }) => ({ borderRadius: 999, padding: 8, backgroundColor: pressed ? "#e5e7eb" : "transparent", opacity: (!hasNext && !loop) ? 0.4 : 1 })}
        >
          <MaterialIcons name="skip-next" size={32} color="#4b5563" />
        </Pressable>
      </View>

      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
        {SPEED_OPTIONS.map((s) => (
          <Pressable
            key={s}
            onPress={() => onSpeedChange?.(s)}
            style={({ pressed }) => ({ borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: speed === s ? "#6366f1" : pressed ? "#e5e7eb" : "#d1d5db" })}
          >
            <Text style={{ fontSize: 12, fontWeight: "500", color: speed === s ? "#fff" : "#374151" }}>{Number.isInteger(s) ? `${s.toFixed(0)}x` : `${s.toFixed(1)}x`}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
