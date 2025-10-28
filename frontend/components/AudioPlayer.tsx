import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react"
import { Pressable, Text, View } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import { useAudioPlayer, useAudioPlayerStatus, AudioSource, setAudioModeAsync } from "expo-audio"

export type AudioTrack = {
  id: string
  title: string
  audioUrl: string
}

export type PlaybackSpeed = 0.5 | 0.7 | 1.0 | 1.25 | 1.5 | 1.7 | 2.0

const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.7, 1.0, 1.25, 1.5, 1.7, 2.0]

// Diagnostics are controlled via the `debug` prop or long-press on play/pause

export type AudioPlayerProps = {
  tracks: AudioTrack[]
  autoPlay?: boolean
  loop?: boolean
  onTrackChange?: (index: number) => void
  onTrackEnd?: (index: number) => void
  // Enable verbose diagnostics logs for investigating playback/auto-advance
  debug?: boolean
}

export type AudioPlayerHandle = {
  goToTrack: (index: number, autoPlay?: boolean) => void
  play: () => void
  pause: () => void
  setSpeed: (speed: PlaybackSpeed) => void
  getCurrentIndex: () => number
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(function AudioPlayer(
  { tracks, autoPlay = true, loop = true, onTrackChange, onTrackEnd, debug = false },
  ref
) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentIndexRef = useRef(0)
  const [isLoopEnabled, setIsLoopEnabled] = useState(loop)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1.0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Diagnostics controlled only via prop
  const DEBUG = Boolean(debug)
  const sessionIdRef = useRef<string>(Math.random().toString(36).slice(2))

  // Create the player with frequent updates and download-first for reliable duration
  const player = useAudioPlayer(undefined, { updateInterval: 250, downloadFirst: true })
  const status = useAudioPlayerStatus(player)
  const hasLoadedInitialTrack = useRef(false)
  const hasTriggeredFinish = useRef(false)
  const finishedTrackIndex = useRef(-1)  // Track which index triggered finish
  const lastProgressLogAt = useRef<number>(0)
  const lastLoadRequest = useRef<{ index: number; ts: number }>({ index: -1, ts: 0 })

  const loadTrack = useCallback(
    async (index: number, shouldAutoPlay = false) => {
      if (index < 0 || index >= tracks.length) return

      // Deduplicate rapid back-to-back requests for the same index
      const now = Date.now()
      if (lastLoadRequest.current.index === index && now - lastLoadRequest.current.ts < 800) {
        if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Skipping duplicate load for track ${index}`)
        return
      }
      lastLoadRequest.current = { index, ts: now }

  const track = tracks[index]
  if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Loading track ${index}/${tracks.length - 1}: ${track.title}, url=${track.audioUrl}, autoPlay=${shouldAutoPlay}, speed=${playbackSpeed}`)
      try {
        hasTriggeredFinish.current = false
        // Don't reset finishedTrackIndex yet - keep it to block stale status updates
        
        // Replace and wait for it to be ready
  await player.replace({ uri: track.audioUrl } as AudioSource)
        
        // Apply playback rate after loading
  await player.setPlaybackRate(playbackSpeed)
  // Ensure position is at start
  try { await player.seekTo(0) } catch {}
        
  setCurrentIndex(index)
  currentIndexRef.current = index
        // Now it's safe to reset finishedTrackIndex since the new track is loaded
        finishedTrackIndex.current = -1
        
        if (shouldAutoPlay) {
          // Give a small delay to ensure player is fully ready
          await new Promise(resolve => setTimeout(resolve, 50))
          await player.play()
          setIsPlaying(true)
          if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Started playing track ${index}`)
          // Verify playback actually started (time should advance)
          try {
            const t0 = player.currentTime || 0
            await new Promise(r => setTimeout(r, 250))
            const t1 = player.currentTime || 0
            if (t1 <= t0 + 0.01) {
              if (DEBUG) console.warn(`[AudioPlayer#${sessionIdRef.current}] Play may have stalled (t0=${t0.toFixed(2)}, t1=${t1.toFixed(2)}), retrying play()`)
              await player.play()
              // Re-verify once after retry
              await new Promise(r => setTimeout(r, 400))
              const t2 = player.currentTime || 0
              if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Post-retry time check: ${t2.toFixed(2)}s`)
            }
          } catch {}
        } else {
          setIsPlaying(false)
        }
        
        onTrackChange?.(index)
      } catch (e) {
        console.error(`[AudioPlayer#${sessionIdRef.current}] Error loading track`, e)
      }
    },
  [tracks, player, onTrackChange, playbackSpeed, DEBUG]
  )

  useImperativeHandle(
    ref,
    () => ({
      goToTrack: (index: number, autoPlayParam = true) => {
        loadTrack(index, autoPlayParam).catch(err => console.error("[AudioPlayer] goToTrack error", err))
      },
      play: () => {
        player.play()
        setIsPlaying(true)
      },
      pause: () => {
        player.pause()
        setIsPlaying(false)
      },
      setSpeed: (speed: PlaybackSpeed) => setPlaybackSpeed(speed),
      getCurrentIndex: () => currentIndex,
    }),
    [loadTrack, player, currentIndex, setIsPlaying]
  )

  useEffect(() => {
    if (tracks.length > 0 && !hasLoadedInitialTrack.current) {
      hasLoadedInitialTrack.current = true
      currentIndexRef.current = 0
      loadTrack(0, autoPlay)
    }
  }, [tracks.length, autoPlay, loadTrack])

  // When speed changes, re-apply to player and keep playback state if it was playing
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await player.setPlaybackRate(playbackSpeed)
        if (!cancelled && isPlaying) {
          // Nudge playback in case setting rate paused it on some platforms
          await player.play()
        }
      } catch (e) {
        console.error("[AudioPlayer] Failed to set playback rate", e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [player, playbackSpeed, isPlaying])

  // Configure audio mode once (iOS silent switch, etc.)
  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true })
      } catch {}
    })()
  }, [])

  // React to status updates from the player
  useEffect(() => {
    // Keep UI in sync
  if (typeof status?.playing === 'boolean') setIsPlaying(status.playing)

    // Log when duration becomes known
    if (DEBUG && status?.isLoaded && status.duration > 0 && status.currentTime === 0) {
      console.log(`[AudioPlayer#${sessionIdRef.current}] Loaded. Duration: ${status.duration.toFixed(2)}s`)
    }

    // Lightweight progress log every ~2s to confirm updates on affected devices
    if (DEBUG && status?.duration > 0 && status?.currentTime >= 0) {
      if (status.currentTime - (lastProgressLogAt.current || 0) >= 2) {
        lastProgressLogAt.current = status.currentTime
        console.log(`[AudioPlayer#${sessionIdRef.current}] Progress: ${status.currentTime.toFixed(2)} / ${status.duration.toFixed(2)}s, playing=${status.playing}`)
      }
    }

    // Prefer didJustFinish signal when available
    if (status?.didJustFinish && !hasTriggeredFinish.current) {
      const idx = currentIndexRef.current
      hasTriggeredFinish.current = true
      finishedTrackIndex.current = idx
      if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Track ${idx} finished (didJustFinish)`) 
      onTrackEnd?.(idx)
      const next = idx + 1
      if (next < tracks.length) {
        loadTrack(next, true).catch(err => console.error("[AudioPlayer] Auto-advance error", err))
      } else if (isLoopEnabled) {
        loadTrack(0, true).catch(err => console.error("[AudioPlayer] Loop error", err))
      }
    }

    // Near-end threshold as a backup
    if (!hasTriggeredFinish.current && status?.duration > 0) {
      const timeRemaining = status.duration - status.currentTime
      const isNearEnd = timeRemaining <= 1.0 || status.currentTime / status.duration >= 0.985
      if (isNearEnd && !status.playing) {
        const idx = currentIndexRef.current
        
        // Skip if we've already processed a finish for any track
        // This prevents stale status updates from the previous track from triggering
        if (finishedTrackIndex.current >= 0 && finishedTrackIndex.current !== idx) {
          if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Ignoring stale near-end idle (finishedTrack=${finishedTrackIndex.current}, currentIdx=${idx})`)
          return
        }
        
        // Only trigger if we haven't already finished this specific track
        if (finishedTrackIndex.current !== idx) {
          hasTriggeredFinish.current = true
          finishedTrackIndex.current = idx
          if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Track ${idx} finished (near-end idle)`) 
          onTrackEnd?.(idx)
          const next = idx + 1
          if (next < tracks.length) {
            loadTrack(next, true).catch(err => console.error("[AudioPlayer] Auto-advance error", err))
          } else if (isLoopEnabled) {
            loadTrack(0, true).catch(err => console.error("[AudioPlayer] Loop error", err))
          }
        }
      }
    }
  }, [status, tracks, isLoopEnabled, onTrackEnd, loadTrack, DEBUG, player])

  // Slim polling fallback for edge cases where status updates stall
  useEffect(() => {
    let lastObsTime = -1
    let lastObsTs = 0
    let lastProgressTime = -1  // Track time for heartbeat independently
    let lastProgressTs = 0
    const interval = setInterval(() => {
      const now = Date.now()
      const currentTime = player.currentTime
      const duration = player.duration
      
      if (DEBUG && Math.random() < 0.1) {
        console.log(`[AudioPlayer#${sessionIdRef.current}] Interval tick: hasTriggeredFinish=${hasTriggeredFinish.current}, currentTime=${currentTime}, currentIndex=${currentIndexRef.current}`)
      }
      
      // Heartbeat safety net: if playback stops progressing for >3s, advance regardless of state
      // This catches silent stalls where isPlaying is true but time isn't advancing
      if (!hasTriggeredFinish.current && currentTime > 0) {
        // Initialize on first check
        if (lastProgressTime < 0) {
          lastProgressTime = currentTime
          lastProgressTs = now
          if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Heartbeat initialized at ${currentTime.toFixed(2)}s`)
        }
        
        const progressed = Math.abs(currentTime - lastProgressTime)
        const elapsed = now - lastProgressTs
        
        if (DEBUG && elapsed > 1000) {
          console.log(`[AudioPlayer#${sessionIdRef.current}] Heartbeat check: elapsed=${elapsed}ms, progressed=${progressed.toFixed(3)}s, currentTime=${currentTime.toFixed(2)}s`)
        }
        
        // If time has progressed significantly, update our baseline
        if (progressed > 0.1) {
          lastProgressTime = currentTime
          lastProgressTs = now
          if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Heartbeat updated (progressed ${progressed.toFixed(3)}s)`)
        }
        // If time hasn't moved in 3+ seconds, force advance
        else if (elapsed >= 3000) {
          const idx = currentIndexRef.current
          hasTriggeredFinish.current = true
          // Reset heartbeat for next track
          lastProgressTime = -1
          lastProgressTs = 0
          console.warn(`[AudioPlayer#${sessionIdRef.current}] Track ${idx} stalled (no progress for ${elapsed}ms, Δt=${progressed.toFixed(3)}s), forcing advance (time: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s)`)
          onTrackEnd?.(idx)
          const next = idx + 1
          if (next < tracks.length) {
            loadTrack(next, true).catch(err => console.error("[AudioPlayer] Auto-advance error", err))
          } else if (isLoopEnabled) {
            loadTrack(0, true).catch(err => console.error("[AudioPlayer] Loop error", err))
          }
          return
        }
      }
      
      if (hasTriggeredFinish.current) {
        lastObsTime = currentTime
        lastObsTs = now
        lastProgressTime = -1  // Reset for next track
        lastProgressTs = 0
        return
      }

      // 1) Primary: duration known and we're at/near end
      if (duration > 0 && currentTime >= 0) {
        const timeRemaining = duration - currentTime
        const isNearEnd = timeRemaining <= 1.0 || currentTime / duration >= 0.99
        if (isNearEnd) {
          const idx = currentIndexRef.current
          if (finishedTrackIndex.current !== idx) {
            hasTriggeredFinish.current = true
            finishedTrackIndex.current = idx
            if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Track ${idx} finished via polling fallback (time: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s)`) 
            onTrackEnd?.(idx)
            const next = idx + 1
            if (next < tracks.length) {
              loadTrack(next, true).catch(err => console.error("[AudioPlayer] Auto-advance error", err))
            } else if (isLoopEnabled) {
              loadTrack(0, true).catch(err => console.error("[AudioPlayer] Loop error", err))
            }
          }
          return
        }
      }

      // 2) Stall-detection near end: if time stops progressing for >1.2s near the end,
      // consider it finished (covers some devices where didJustFinish isn't raised).
      if (duration > 0 && currentTime >= 0) {
        const progressed = Math.abs(currentTime - (lastObsTime < 0 ? currentTime : lastObsTime))
        const elapsed = now - (lastObsTs || now)
        const nearEnd = currentTime / duration >= 0.97
        if (nearEnd && elapsed >= 1200 && progressed <= 0.01) {
          const idx = currentIndexRef.current
          if (finishedTrackIndex.current !== idx) {
            hasTriggeredFinish.current = true
            finishedTrackIndex.current = idx
            if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Track ${idx} finished via stall-detect (time: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s, Δt=${progressed.toFixed(3)}, elapsed=${elapsed}ms)`)
            onTrackEnd?.(idx)
            const next = idx + 1
            if (next < tracks.length) {
              loadTrack(next, true).catch(err => console.error("[AudioPlayer] Auto-advance error", err))
            } else if (isLoopEnabled) {
              loadTrack(0, true).catch(err => console.error("[AudioPlayer] Loop error", err))
            }
          }
          return
        }
      }

      // 3) Fallback when duration is unknown: if playback stops after some progress, advance
      if ((duration === 0 || !isFinite(duration)) && currentTime > 0) {
        const progressed = Math.abs(currentTime - (lastObsTime < 0 ? currentTime : lastObsTime))
        const elapsed = now - (lastObsTs || now)
        if (elapsed >= 1500 && progressed <= 0.01) {
          const idx = currentIndexRef.current
          if (finishedTrackIndex.current !== idx) {
            hasTriggeredFinish.current = true
            finishedTrackIndex.current = idx
            if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Track ${idx} finished (unknown duration fallback, time ~ ${currentTime.toFixed(2)}s, elapsed=${elapsed}ms)`) 
            onTrackEnd?.(idx)
            const next = idx + 1
            if (next < tracks.length) {
              loadTrack(next, true).catch(err => console.error("[AudioPlayer] Auto-advance error", err))
            } else if (isLoopEnabled) {
              loadTrack(0, true).catch(err => console.error("[AudioPlayer] Loop error", err))
            }
          }
          return
        }
      }

      // Update observation state
      lastObsTime = currentTime
      lastObsTs = now
    }, 500)
    return () => clearInterval(interval)
  }, [player, tracks.length, isLoopEnabled, onTrackEnd, loadTrack, DEBUG])
  

  useEffect(() => {
    return () => {
      try {
        if (player.playing) player.pause()
      } catch {}
    }
  }, [player])

  const handlePlayPause = async () => {
    // Prefer direct player getters for robustness
    const ct = player.currentTime || 0
    const dur = player.duration || 0
    const didFinish = Boolean(status?.didJustFinish) || (dur > 0 && ct >= dur - 0.05)
    if (DEBUG) console.log(`[AudioPlayer#${sessionIdRef.current}] Play/Pause clicked, currently playing: ${player.playing}`)
    try {
      if (player.playing) {
        await player.pause()
        setIsPlaying(false)
        return
      }

      // If finished (loop off case) or at end, rewind before playing
      if (didFinish) {
        if (DEBUG) console.log('[AudioPlayer] At end, seeking to 0 before play')
        try { await player.seekTo(0) } catch {}
        hasTriggeredFinish.current = false
      }

      // Ensure rate is applied (some platforms pause on rate change)
      try { await player.setPlaybackRate(playbackSpeed) } catch {}

      await player.play()
      setIsPlaying(true)

      // Verify playback advances; if not, micro-seek and retry once
      try {
        const t0 = player.currentTime || 0
        await new Promise(r => setTimeout(r, 250))
        const t1 = player.currentTime || 0
        if (t1 <= t0 + 0.01) {
          if (DEBUG) console.warn(`[AudioPlayer#${sessionIdRef.current}] Play may have stalled after click (t0=${t0.toFixed(2)}, t1=${t1.toFixed(2)}), nudging...`)
          try { await player.seekTo(0.02) } catch {}
          await player.play()
        }
      } catch {}
    } catch (e) {
      console.error(`[AudioPlayer#${sessionIdRef.current}] Play/Pause error`, e)
    }
  }
  const handleStop = () => {
    player.pause()
    player.seekTo(0)
    setIsPlaying(false)
  }
  const handlePrev = async () => {
    const prev = currentIndex - 1
    if (prev >= 0) await loadTrack(prev, true)
  }
  const handleNext = async () => {
    const next = currentIndex + 1
    if (next < tracks.length) await loadTrack(next, true)
    else if (isLoopEnabled) await loadTrack(0, true)
  }

  if (tracks.length === 0) return null

  return (
    <View style={{ paddingVertical: 16 }}>
      

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
        <Pressable
          onPress={handlePlayPause}
          style={({ pressed }) => ({ borderRadius: 999, backgroundColor: "#6366f1", padding: 12, opacity: pressed ? 0.8 : 1 })}
        >
          <MaterialIcons name={isPlaying ? "pause" : "play-arrow"} size={32} color="#fff" />
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
