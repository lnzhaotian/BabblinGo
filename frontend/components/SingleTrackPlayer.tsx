import React, { useEffect, useRef, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import { useAudioPlayer, useAudioPlayerStatus, AudioSource, setAudioModeAsync } from "expo-audio"

export type PlaybackSpeed = 0.5 | 0.7 | 1.0 | 1.3 | 1.5 | 1.7 | 2.0
const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.7, 1.0, 1.3, 1.5, 1.7, 2.0]

export type SingleTrack = {
  id: string
  title?: string
  audioUrl: string
}

/**
 * SingleTrackPlayer – plays exactly one audio track.
 *
 * Component contract:
 * - Receives controlled props: speed (parent controls) and loop (read-only).
 * - Emits onSpeedChange when user taps a speed chip, so parent can persist it
 *   across slide changes and remounts.
 * - Emits onNavigate('prev'|'next') for navigation button clicks; parent decides
 *   the target slide and performs the scroll.
 * - Emits onFinish() once per track end (guarded) so parent can advance slides.
 *
 * Mount/remount behavior:
 * - The parent renders this with key={slideId}, so changing slides destroys
 *   the old instance and mounts a fresh one. We only load/replace on mount,
 *   not on every prop change, which avoids race conditions during fast swipes.
 */
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
  // Optional external controls
  suspend?: boolean  // when true, pause playback
  playSignal?: number // incrementing number triggers a play() if not suspended
}

export default function SingleTrackPlayer({ track, autoPlay = true, speed, loop, debug = false, hasPrev = false, hasNext = false, onSpeedChange, onFinish, onNavigate, suspend = false, playSignal }: SingleTrackPlayerProps) {
  const DEBUG = !!debug
  const player = useAudioPlayer(undefined, { updateInterval: 250, downloadFirst: true })
  const status = useAudioPlayerStatus(player)
  const [isPlaying, setIsPlaying] = useState(false)
  const sessionIdRef = useRef<string>(Math.random().toString(36).slice(2))
  const mountedRef = useRef(true)
  const hasStartedRef = useRef(false)
  const hasCalledFinishRef = useRef(false)
  const lastProgressLogAt = useRef<number>(0)
  // Track the intended play state (avoids relying on laggy status.playing during rate changes)
  const shouldBePlayingRef = useRef(false)
  const ensurePlayingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Configure audio mode (iOS silent switch) so audio plays even if the device
  // is in silent mode. Do this once per mount.
  useEffect(() => {
    (async () => {
      try { await setAudioModeAsync({ playsInSilentMode: true }) } catch {}
    })()
  }, [])

  // Load and (optionally) play on mount
  // We intentionally do not re-run this on every prop change. Parent will
  // remount on slide change by altering the React key.
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

        if (autoPlay && !suspend) {
          try {
            await player.play()
            hasStartedRef.current = true
            setIsPlaying(true)
            shouldBePlayingRef.current = true
            if (DEBUG) console.log(`[SingleTrack#${sessionIdRef.current}] Started`)
            // Post-start guard: re-assert playing shortly after start to catch
            // platforms that momentarily pause on initialization.
            if (ensurePlayingTimeoutRef.current) clearTimeout(ensurePlayingTimeoutRef.current)
            ensurePlayingTimeoutRef.current = setTimeout(async () => {
              try {
                const nearEnd = status && status.duration > 0 && (status.duration - status.currentTime) <= 1.0
                if (!suspend && shouldBePlayingRef.current && !nearEnd) {
                  // If status reports paused shortly after start, try to resume
                  if (!player.playing) {
                    if (DEBUG) console.log(`[SingleTrack#${sessionIdRef.current}] Post-start ensure play`)
                    await player.setPlaybackRate(speed)
                    await player.play()
                    setIsPlaying(true)
                  }
                }
              } catch {}
            }, 250)
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
  // When parent updates speed, set the playback rate and, if we intend to be playing,
  // explicitly resume. This avoids relying on status.playing, which can lag and cause
  // a missed resume on some platforms.
  useEffect(() => {
    ;(async () => {
      try {
        const before = shouldBePlayingRef.current && !suspend
        if (DEBUG) console.log(`[SingleTrack#${sessionIdRef.current}] setPlaybackRate(${speed}) (intendsPlaying=${before})`)
        await player.setPlaybackRate(speed)
        // Some platforms pause on rate change; resume if we intend to be playing.
        if (before) {
          try {
            await player.play()
            if (DEBUG) console.log(`[SingleTrack#${sessionIdRef.current}] Resume after rate change`)
          } catch {}
        }
      } catch {}
    })()
  }, [player, speed, suspend, DEBUG])

  // Respond to suspend changes
  useEffect(() => {
    (async () => {
      try {
        if (suspend && player.playing) {
          await player.pause()
          setIsPlaying(false)
          shouldBePlayingRef.current = false
        }
      } catch {}
    })()
  }, [suspend, player])

  // External play trigger
  useEffect(() => {
    (async () => {
      try {
        if (playSignal != null && !suspend) {
          await player.setPlaybackRate(speed)
          await player.play()
          setIsPlaying(true)
          shouldBePlayingRef.current = true
        }
      } catch {}
    })()
    // playSignal is a number that increments to trigger; include it directly
  }, [playSignal, suspend, player, speed])

  // Keep UI in sync and detect finish
  // We guard onFinish with hasCalledFinishRef to avoid duplicate signals
  // (didJustFinish + near-end idle can arrive closely together on some devices).
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
      // If we unexpectedly paused not near the end and we intend to be playing, try to recover.
      if (!status.playing && timeRemaining > 1.0 && shouldBePlayingRef.current && !suspend) {
        (async () => {
          try {
            if (DEBUG) console.log(`[SingleTrack#${sessionIdRef.current}] Unexpected pause mid-track; attempting resume`)
            await player.setPlaybackRate(speed)
            await player.play()
            setIsPlaying(true)
          } catch {}
        })()
      }
    }
  }, [status, DEBUG, onFinish, player, speed, suspend])

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (ensurePlayingTimeoutRef.current) {
        clearTimeout(ensurePlayingTimeoutRef.current)
        ensurePlayingTimeoutRef.current = null
      }
      try { if (player.playing) player.pause() } catch {}
    }
  }, [player])

  // Play/Pause button behavior
  // If the track already finished (e.g., last slide with loop off) and the
  // user presses Play, we seek to the start so it replays without remounting.
  const handlePlayPause = async () => {
    try {
      if (player.playing) {
        await player.pause()
        setIsPlaying(false)
        shouldBePlayingRef.current = false
      } else {
        // If at end, seek to start before playing
        if (status && status.duration > 0 && status.currentTime >= status.duration - 0.5) {
          await player.seekTo(0)
          hasCalledFinishRef.current = false
        }
        try { await player.setPlaybackRate(speed) } catch {}
        await player.play()
        setIsPlaying(true)
        shouldBePlayingRef.current = true
      }
    } catch (e) {
      console.error(`[SingleTrack#${sessionIdRef.current}] Play/Pause error`, e)
    }
  }

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
        {/* Navigation controls: enabled if neighbor exists OR loop is on. The parent
            is authoritative about slide boundaries and loop behavior. */}
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
        {/* Speed selector – calls onSpeedChange so the parent can store the new value
            and feed it back as a controlled prop (survives remounts). */}
        {SPEED_OPTIONS.map((s) => (
          <Pressable
            key={s}
            onPress={() => onSpeedChange?.(s)}
            style={({ pressed }) => ({ borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: speed === s ? "#6366f1" : pressed ? "#e5e7eb" : "#d1d5db" })}
          >
            <Text style={{ fontSize: 12, fontWeight: "500", color: speed === s ? "#fff" : "#374151" }}>{s.toFixed(1)}x</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
