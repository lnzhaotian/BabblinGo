import { useState, useEffect, useRef, useCallback } from "react"
import { AppState, type AppStateStatus, Alert } from "react-native"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"
import {
  loadLearningPreferences,
  saveLearningSession,
  MIN_SESSION_DURATION,
  type LearningPreferences,
} from "@/lib/session-manager"

interface SessionInfo {
  lessonId: string
  lessonTitle: string
}

interface UseAutoSessionResult {
  // State
  sessionActive: boolean
  sessionPaused: boolean
  remainingSeconds: number
  preferences: LearningPreferences | null

  // Actions
  startSession: (sessionInfo: SessionInfo) => void
  pauseSession: () => void
  resumeSession: () => void
  stopSession: (showAlert?: boolean) => void
}

/**
 * Hook for managing automatic learning sessions with timer and AppState monitoring
 * 
 * Features:
 * - Loads user preferences for session length and playback speed
 * - Countdown timer that updates every second
 * - Auto-pause when app goes to background
 * - Auto-resume when app returns to foreground
 * - Saves session record to AsyncStorage when completed or stopped (if >= 2 min)
 * - Shows celebration alert when time is up
 */
export function useAutoSession(): UseAutoSessionResult {
  const [sessionActive, setSessionActive] = useState(false)
  const [sessionPaused, setSessionPaused] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [preferences, setPreferences] = useState<LearningPreferences | null>(null)

  const sessionInfoRef = useRef<SessionInfo | null>(null)
  const sessionStartTimeRef = useRef<number | null>(null)
  const sessionEndTimeRef = useRef<number | null>(null)
  const plannedSecondsRef = useRef(0)
  const playbackSpeedRef = useRef<PlaybackSpeed>(1.0 as PlaybackSpeed)

  // Load preferences on mount
  useEffect(() => {
    loadLearningPreferences().then(setPreferences).catch(console.error)
  }, [])

  // Handle time up - defined before useEffect that uses it
  const handleTimeUp = useCallback(() => {
    const startTime = sessionStartTimeRef.current
    const endTime = Date.now()
    const sessionInfo = sessionInfoRef.current

    // Save session record
    if (startTime && sessionInfo) {
      saveLearningSession({
        lessonId: sessionInfo.lessonId,
        lessonTitle: sessionInfo.lessonTitle,
        startedAt: startTime,
        endedAt: endTime,
        plannedSeconds: plannedSecondsRef.current,
        speed: playbackSpeedRef.current,
        finished: true,
      }).catch(console.error)
    }

    // Reset state
    setSessionActive(false)
    setSessionPaused(false)
    setRemainingSeconds(0)
    sessionStartTimeRef.current = null
    sessionEndTimeRef.current = null
    sessionInfoRef.current = null

    // Show celebration alert
    Alert.alert(
      "🎉 Time's Up!",
      "Great job! You've completed your learning session.",
      [{ text: "OK", style: "default" }]
    )
  }, [])

  // Pause session (freezes countdown)
  const pauseSession = useCallback(() => {
    if (!sessionActive || sessionPaused) {
      return
    }

    // Freeze remaining seconds
    if (sessionEndTimeRef.current) {
      const now = Date.now()
      const remainMs = sessionEndTimeRef.current - now
      const remainSec = Math.max(0, Math.ceil(remainMs / 1000))
      setRemainingSeconds(remainSec)
    }

    sessionEndTimeRef.current = null
    setSessionPaused(true)
    console.log("Session paused")
  }, [sessionActive, sessionPaused])

  // Resume session (restarts countdown)
  const resumeSession = useCallback(() => {
    if (!sessionActive || !sessionPaused) {
      return
    }

    const now = Date.now()
    sessionEndTimeRef.current = now + remainingSeconds * 1000
    setSessionPaused(false)
    console.log("Session resumed")
  }, [sessionActive, sessionPaused, remainingSeconds])

  // Countdown timer - ticks every second when active and not paused
  useEffect(() => {
    if (!sessionActive || sessionPaused || !sessionEndTimeRef.current) {
      return
    }

    const tick = () => {
      const now = Date.now()
      const remainMs = sessionEndTimeRef.current! - now
      const remainSec = Math.max(0, Math.ceil(remainMs / 1000))
      
      setRemainingSeconds(remainSec)

      // Time's up!
      if (remainSec <= 0) {
        handleTimeUp()
      }
    }

    // Tick immediately, then every second
    tick()
    const interval = setInterval(tick, 1000)

    return () => clearInterval(interval)
  }, [sessionActive, sessionPaused, handleTimeUp])

  // Monitor AppState for background/foreground transitions
  useEffect(() => {
    if (!sessionActive) {
      return
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        // App going to background - pause the timer
        if (!sessionPaused) {
          pauseSession()
        }
      } else if (nextAppState === "active") {
        // App coming back to foreground - resume if was running
        if (sessionPaused && sessionActive) {
          resumeSession()
        }
      }
    }

    const subscription = AppState.addEventListener("change", handleAppStateChange)

    return () => {
      subscription.remove()
    }
  }, [sessionActive, sessionPaused, pauseSession, resumeSession])

  // Save session on unmount if active and meets minimum duration
  useEffect(() => {
    return () => {
      if (!sessionActive || !sessionStartTimeRef.current || !sessionInfoRef.current) {
        return
      }

      const startTime = sessionStartTimeRef.current
      const endTime = Date.now()
      const durationSeconds = Math.floor((endTime - startTime) / 1000)

      // Only save if meets minimum duration
      if (durationSeconds >= MIN_SESSION_DURATION) {
        saveLearningSession({
          lessonId: sessionInfoRef.current.lessonId,
          lessonTitle: sessionInfoRef.current.lessonTitle,
          startedAt: startTime,
          endedAt: endTime,
          plannedSeconds: plannedSecondsRef.current,
          speed: playbackSpeedRef.current,
          finished: false,
        }).catch(console.error)
      }
    }
  }, [sessionActive])

  // Start a new session
  const startSession = useCallback(
    (sessionInfo: SessionInfo) => {
      if (!preferences) {
        console.warn("Preferences not loaded yet")
        return
      }

      const now = Date.now()
      const durationSeconds = preferences.sessionLength

      sessionInfoRef.current = sessionInfo
      sessionStartTimeRef.current = now
      sessionEndTimeRef.current = now + durationSeconds * 1000
      plannedSecondsRef.current = durationSeconds
      playbackSpeedRef.current = preferences.playbackSpeed

      setRemainingSeconds(durationSeconds)
      setSessionActive(true)
      setSessionPaused(false)

      console.log(`Started session: ${durationSeconds}s for ${sessionInfo.lessonTitle}`)
    },
    [preferences]
  )

  // Stop session manually
  const stopSession = useCallback(
    (showAlert = true) => {
      if (!sessionActive) {
        return
      }

      const startTime = sessionStartTimeRef.current
      const endTime = Date.now()
      const sessionInfo = sessionInfoRef.current

      // Save session record if meets minimum duration
      if (startTime && sessionInfo) {
        const durationSeconds = Math.floor((endTime - startTime) / 1000)

        if (durationSeconds >= MIN_SESSION_DURATION) {
          saveLearningSession({
            lessonId: sessionInfo.lessonId,
            lessonTitle: sessionInfo.lessonTitle,
            startedAt: startTime,
            endedAt: endTime,
            plannedSeconds: plannedSecondsRef.current,
            speed: playbackSpeedRef.current,
            finished: false,
          }).catch(console.error)

          if (showAlert) {
            Alert.alert(
              "Session Stopped",
              `Your ${Math.floor(durationSeconds / 60)} minute session has been saved.`,
              [{ text: "OK", style: "default" }]
            )
          }
        } else if (showAlert) {
          Alert.alert(
            "Session Too Short",
            `Sessions must be at least ${Math.floor(MIN_SESSION_DURATION / 60)} minutes to be saved.`,
            [{ text: "OK", style: "default" }]
          )
        }
      }

      // Reset state
      setSessionActive(false)
      setSessionPaused(false)
      setRemainingSeconds(0)
      sessionStartTimeRef.current = null
      sessionEndTimeRef.current = null
      sessionInfoRef.current = null

      console.log("Session stopped")
    },
    [sessionActive]
  )

  return {
    sessionActive,
    sessionPaused,
    remainingSeconds,
    preferences,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
  }
}
