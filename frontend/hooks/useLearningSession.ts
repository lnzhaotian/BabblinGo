import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { saveLearningSession } from "@/lib/session-manager"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"

export type LearningSessionMode = "landing" | "active" | "results"

const DEFAULT_SESSION_SECONDS = 10 * 60 // 10 minutes
const SESSION_LENGTH_KEY = "learning.sessionLength"

export function useLearningSession(
  lessonId: string | undefined,
  lessonTitle: string | undefined,
  opts?: { defaultSeconds?: number; speed?: PlaybackSpeed; loop?: boolean }
) {
  const [mode, setMode] = useState<LearningSessionMode>("landing")
  const [configuredSeconds, setConfiguredSeconds] = useState<number>(opts?.defaultSeconds ?? DEFAULT_SESSION_SECONDS)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(configuredSeconds)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  // Load global default session length from learning.sessionLength (same key as settings page)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_LENGTH_KEY)
        const n = raw ? Number(raw) : NaN
        const value = Number.isFinite(n) && n > 0 ? n : (opts?.defaultSeconds ?? DEFAULT_SESSION_SECONDS)
        if (mounted) {
          setConfiguredSeconds(value)
          setRemainingSeconds(value)
        }
        if (mounted) {
          setSessionReady(true)
        }
      } catch {
        if (mounted) {
          setConfiguredSeconds(opts?.defaultSeconds ?? DEFAULT_SESSION_SECONDS)
          setRemainingSeconds(opts?.defaultSeconds ?? DEFAULT_SESSION_SECONDS)
          setSessionReady(true)
        }
      }
    })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const activateSession = useCallback(() => {
    stopTimer()
    const duration = configuredSeconds > 0 ? configuredSeconds : DEFAULT_SESSION_SECONDS
    setMode("active")
    setStartedAt(new Date())
    setRemainingSeconds(duration)
    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current as any)
          timerRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [configuredSeconds, stopTimer])

  const startSession = useCallback(() => {
    if (mode === "active") {
      return
    }
    activateSession()
  }, [activateSession, mode])

  // When countdown reaches 0, end the session
  useEffect(() => {
    if (mode === "active" && remainingSeconds === 0) {
      stopTimer()
      setMode("results")
    }
  }, [mode, remainingSeconds, stopTimer])

  const restartSession = useCallback(() => {
    activateSession()
  }, [activateSession])

  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return 0
    if (mode === "active") {
      return Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000))
    }
    // results or landing (after end)
    const planned = configuredSeconds
    return Math.min(planned, Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)))
  }, [startedAt, mode, configuredSeconds])

  const persistSession = useCallback(
    async (finished: boolean) => {
      if (!lessonId || !lessonTitle || !startedAt) return
      const endedAt = new Date()
      await saveLearningSession({
        lessonId,
        lessonTitle,
        startedAt: startedAt.getTime(),
        endedAt: endedAt.getTime(),
        plannedSeconds: configuredSeconds,
        speed: opts?.speed || (1.0 as PlaybackSpeed),
        finished,
      })
    },
    [lessonId, lessonTitle, startedAt, configuredSeconds, opts?.speed]
  )

  // On results mode entry, persist session once
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (mode === "results" && !hasSavedRef.current) {
      hasSavedRef.current = true
      // If session ended naturally, finished=true
      persistSession(remainingSeconds === 0)
    }
    if (mode !== "results") {
      hasSavedRef.current = false
    }
  }, [mode, persistSession, remainingSeconds])
  // Save session on manual exit (unfinished)
  useEffect(() => {
    if (mode === "active") {
      return () => {
        if (startedAt) {
          // If user leaves before timer ends, save as unfinished
          persistSession(false)
        }
      }
    }
    return undefined
  }, [mode, startedAt, persistSession])

  useEffect(() => () => stopTimer(), [stopTimer])

  useEffect(() => {
    if (sessionReady && mode === "landing") {
      startSession()
    }
  }, [sessionReady, mode, startSession])

  return {
    mode,
    configuredSeconds,
    remainingSeconds,
    elapsedSeconds,
    startSession,
    restartSession,
    sessionReady,
  }
}

export function formatSecondsMMSS(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
