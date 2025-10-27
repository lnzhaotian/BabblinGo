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

// Toggle to true while debugging to see detailed logs
const DEBUG = false

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
  const [isPlaying, setIsPlaying] = useState(false)

  // Create the player with frequent updates and download-first for reliable duration
  const player = useAudioPlayer(undefined, { updateInterval: 250, downloadFirst: true })
  const status = useAudioPlayerStatus(player)
  const hasLoadedInitialTrack = useRef(false)
  const hasTriggeredFinish = useRef(false)
  const lastProgressLogAt = useRef<number>(0)
  const lastLoadRequest = useRef<{ index: number; ts: number }>({ index: -1, ts: 0 })

  const loadTrack = useCallback(
    async (index: number, shouldAutoPlay = false) => {
      if (index < 0 || index >= tracks.length) return

      // Deduplicate rapid back-to-back requests for the same index
      const now = Date.now()
      if (lastLoadRequest.current.index === index && now - lastLoadRequest.current.ts < 800) {
        // console.log(`[AudioPlayer] Skipping duplicate load for track ${index}`)
        return
      }
      lastLoadRequest.current = { index, ts: now }

  const track = tracks[index]
  if (DEBUG) console.log(`[AudioPlayer] Loading track ${index}: ${track.title}, autoPlay: ${shouldAutoPlay}, speed: ${playbackSpeed}`)
      try {
        hasTriggeredFinish.current = false
        
        // Replace and wait for it to be ready
  await player.replace({ uri: track.audioUrl } as AudioSource)
        
        // Apply playback rate after loading
  await player.setPlaybackRate(playbackSpeed)
  // Ensure position is at start
  try { await player.seekTo(0) } catch {}
        
        setCurrentIndex(index)
        
        if (shouldAutoPlay) {
          // Give a small delay to ensure player is fully ready
          await new Promise(resolve => setTimeout(resolve, 50))
          await player.play()
          setIsPlaying(true)
          if (DEBUG) console.log(`[AudioPlayer] Started playing track ${index}`)
          // Verify playback actually started (time should advance)
          try {
            const t0 = player.currentTime || 0
            await new Promise(r => setTimeout(r, 250))
            const t1 = player.currentTime || 0
            if (t1 <= t0 + 0.01) {
              if (DEBUG) console.warn(`[AudioPlayer] Play may have stalled (t0=${t0.toFixed(2)}, t1=${t1.toFixed(2)}), retrying play()`)
              await player.play()
              // Re-verify once after retry
              await new Promise(r => setTimeout(r, 400))
              const t2 = player.currentTime || 0
              if (DEBUG) console.log(`[AudioPlayer] Post-retry time check: ${t2.toFixed(2)}s`)
            }
          } catch {}
        } else {
          setIsPlaying(false)
        }
        
        onTrackChange?.(index)
      } catch (e) {
        console.error("[AudioPlayer] Error loading track", e)
      }
    },
    [tracks, player, onTrackChange, playbackSpeed]
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
      console.log(`[AudioPlayer] Loaded. Duration: ${status.duration.toFixed(2)}s`)
    }

    // Lightweight progress log every ~2s to confirm updates on affected devices
    if (DEBUG && status?.duration > 0 && status?.currentTime >= 0) {
      if (status.currentTime - (lastProgressLogAt.current || 0) >= 2) {
        lastProgressLogAt.current = status.currentTime
        console.log(`[AudioPlayer] Progress: ${status.currentTime.toFixed(2)} / ${status.duration.toFixed(2)}s, playing=${status.playing}`)
      }
    }

    // Prefer didJustFinish signal when available
    if (status?.didJustFinish && !hasTriggeredFinish.current) {
      hasTriggeredFinish.current = true
      if (DEBUG) console.log(`[AudioPlayer] Track ${currentIndex} finished (didJustFinish)`) 
      onTrackEnd?.(currentIndex)
      const next = currentIndex + 1
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
        hasTriggeredFinish.current = true
        if (DEBUG) console.log(`[AudioPlayer] Track ${currentIndex} finished (near-end idle)`) 
        onTrackEnd?.(currentIndex)
        const next = currentIndex + 1
        if (next < tracks.length) {
          loadTrack(next, true).catch(err => console.error("[AudioPlayer] Auto-advance error", err))
        } else if (isLoopEnabled) {
          loadTrack(0, true).catch(err => console.error("[AudioPlayer] Loop error", err))
        }
      }
    }
  }, [status, currentIndex, tracks.length, isLoopEnabled, onTrackEnd, loadTrack])

  // Slim polling fallback for edge cases where status updates stall
  useEffect(() => {
    const interval = setInterval(() => {
      // Also check for track finish as a very last resort
      const currentTime = player.currentTime
      const duration = player.duration
      if (duration > 0 && currentTime >= 0 && !hasTriggeredFinish.current) {
        const timeRemaining = duration - currentTime
        const isNearEnd = timeRemaining <= 1.0 || currentTime / duration >= 0.99

        if (isNearEnd) {
          hasTriggeredFinish.current = true
          console.log(`[AudioPlayer] Track ${currentIndex} finished via polling fallback (time: ${currentTime.toFixed(2)}s / ${duration.toFixed(2)}s)`) 
          onTrackEnd?.(currentIndex)
          const next = currentIndex + 1
          if (next < tracks.length) {
            loadTrack(next, true).catch(err => console.error("[AudioPlayer] Auto-advance error", err))
          } else if (isLoopEnabled) {
            loadTrack(0, true).catch(err => console.error("[AudioPlayer] Loop error", err))
          }
        }
      }
    }, 500)
    return () => clearInterval(interval)
  }, [player, currentIndex, tracks.length, isLoopEnabled, onTrackEnd, loadTrack])
  

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
    if (DEBUG) console.log(`[AudioPlayer] Play/Pause clicked, currently playing: ${player.playing}`)
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
          if (DEBUG) console.warn(`[AudioPlayer] Play may have stalled after click (t0=${t0.toFixed(2)}, t1=${t1.toFixed(2)}), nudging...`)
          try { await player.seekTo(0.02) } catch {}
          await player.play()
        }
      } catch {}
    } catch (e) {
      console.error('[AudioPlayer] Play/Pause error', e)
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
        <Pressable onPress={handlePlayPause} style={({ pressed }) => ({ borderRadius: 999, backgroundColor: "#6366f1", padding: 12, opacity: pressed ? 0.8 : 1 })}>
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
