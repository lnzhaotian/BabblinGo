import { useCallback, useEffect, useRef, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect } from "@react-navigation/native"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"

/**
 * Custom hook for managing lesson preferences (playback speed and loop)
 * 
 * - Loads preferences from AsyncStorage on mount and when screen gains focus
 * - Persists loop setting automatically
 * - Speed is session-only in lessons (loaded as default but not persisted)
 */
export function useLessonPreferences() {
  const [playerSpeed, setPlayerSpeed] = useState<PlaybackSpeed>(1.0 as PlaybackSpeed)
  const [loopEnabled, setLoopEnabled] = useState<boolean>(true)
  const [defaultMode, setDefaultMode] = useState<"listen-only" | "listen-and-repeat">("listen-only")
  const [maxAttempts, setMaxAttempts] = useState<number>(3)
  const prefsLoadedRef = useRef(false)

  const loadPrefs = useCallback(async () => {
    try {
      const [[, savedSpeed], [, savedLoop], [, savedMode], [, savedAttempts]] = await AsyncStorage.multiGet([
        "learning.playbackSpeed",
        "lesson.loopEnabled",
        "learning.defaultMode",
        "learning.maxAttempts",
      ])
      
      if (savedSpeed) {
        const n = Number(savedSpeed)
        if (!Number.isNaN(n)) setPlayerSpeed(n as PlaybackSpeed)
      }
      if (savedLoop != null) {
        setLoopEnabled(savedLoop === "true")
      }
      if (savedMode === "listen-and-repeat") {
        setDefaultMode("listen-and-repeat")
      } else {
        setDefaultMode("listen-only")
      }
      if (savedAttempts) {
        const n = parseInt(savedAttempts, 10)
        if (!Number.isNaN(n)) setMaxAttempts(n)
      }
      prefsLoadedRef.current = true
    } catch {
      // Non-fatal: fall back to defaults
      prefsLoadedRef.current = true
    }
  }, [])

  useEffect(() => {
    loadPrefs()
  }, [loadPrefs])

  useFocusEffect(
    useCallback(() => {
      // Reload preferences whenever the screen gains focus
      loadPrefs()
      return () => {}
    }, [loadPrefs])
  )

  // Persist loop setting (speed is session-only in lessons)
  useEffect(() => {
    if (!prefsLoadedRef.current) return
    AsyncStorage.setItem("lesson.loopEnabled", String(loopEnabled)).catch(() => {})
  }, [loopEnabled])

  return {
    playerSpeed,
    setPlayerSpeed,
    loopEnabled,
    setLoopEnabled,
    defaultMode,
    maxAttempts,
    prefsLoaded: prefsLoadedRef.current,
  }
}
