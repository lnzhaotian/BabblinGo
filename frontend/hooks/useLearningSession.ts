import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { saveLearningSession } from "@/lib/session-manager"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"

export type LearningSessionMode = "landing" | "active" | "results"

const DEFAULT_SESSION_SECONDS = 10 * 60 // 10 minutes
const SESSION_LENGTH_KEY = "learning.sessionLength"

const createRunId = (lessonId?: string) =>
  `${lessonId ?? "lesson"}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

export function useLearningSession(
  lessonId: string | undefined,
  lessonTitle: string | undefined,
  opts?: { defaultSeconds?: number; speed?: PlaybackSpeed; loop?: boolean; enabled?: boolean }
) {
  const enabled = opts?.enabled ?? true
  const defaultSeconds = opts?.defaultSeconds ?? DEFAULT_SESSION_SECONDS

  const [mode, setMode] = useState<LearningSessionMode>(enabled ? "landing" : "active")
  const [configuredSeconds, setConfiguredSeconds] = useState<number>(defaultSeconds)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(enabled ? defaultSeconds : 0)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [sessionReady, setSessionReady] = useState(enabled ? false : true)
  const lessonIdRef = useRef<string | undefined>(lessonId)
  const runIdRef = useRef<string | null>(null)
  const finishingRef = useRef(false)
  const lessonTitleRef = useRef<string | undefined>(lessonTitle)
  const configuredSecondsRef = useRef<number>(configuredSeconds)
  const speedRef = useRef<PlaybackSpeed>(opts?.speed ?? (1.0 as PlaybackSpeed))
  const startedAtRef = useRef<Date | null>(startedAt)

  useEffect(() => {
    lessonTitleRef.current = lessonTitle
  }, [lessonTitle])

  useEffect(() => {
    lessonIdRef.current = lessonId
  }, [lessonId])

  useEffect(() => {
    configuredSecondsRef.current = configuredSeconds
  }, [configuredSeconds])

  useEffect(() => {
    if (opts?.speed) {
      speedRef.current = opts.speed
    }
  }, [opts?.speed])

  useEffect(() => {
    startedAtRef.current = startedAt
  }, [startedAt])

  // Load global default session length from learning.sessionLength (same key as settings page)
  useEffect(() => {
    if (!enabled) {
      return
    }

    let mounted = true
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_LENGTH_KEY)
        const n = raw ? Number(raw) : NaN
        const value = Number.isFinite(n) && n > 0 ? n : defaultSeconds
        if (mounted) {
          setConfiguredSeconds(value)
          setRemainingSeconds(value)
        }
        if (mounted) {
          setSessionReady(true)
        }
      } catch {
        if (mounted) {
          setConfiguredSeconds(defaultSeconds)
          setRemainingSeconds(defaultSeconds)
          setSessionReady(true)
        }
      }
    })()
    return () => { mounted = false }
  }, [enabled, defaultSeconds])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setMode("active")
      setConfiguredSeconds(defaultSeconds)
      setRemainingSeconds(0)
      setSessionReady(true)
      stopTimer()
      return
    }

    setMode("landing")
    setSessionReady(false)
    setConfiguredSeconds(defaultSeconds)
    setRemainingSeconds(defaultSeconds)
    stopTimer()
  }, [enabled, defaultSeconds, stopTimer])

  const activateSession = useCallback(() => {
    if (!enabled) {
      return
    }

    stopTimer()
    if (!runIdRef.current) {
      runIdRef.current = createRunId(lessonId)
    }
    finishingRef.current = false
    const duration = configuredSeconds > 0 ? configuredSeconds : DEFAULT_SESSION_SECONDS
    const startTime = new Date()
    setMode("active")
    setStartedAt(startTime)
    startedAtRef.current = startTime
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
  }, [configuredSeconds, lessonId, stopTimer, enabled])

  const startSession = useCallback(() => {
    if (!enabled) {
      return
    }

    if (mode === "active") {
      return
    }
    activateSession()
  }, [activateSession, mode, enabled])

  // When countdown reaches 0, end the session
  useEffect(() => {
    if (!enabled) {
      return
    }

    if (mode === "active" && remainingSeconds === 0) {
      finishingRef.current = true
      stopTimer()
      setMode("results")
    }
  }, [mode, remainingSeconds, stopTimer, enabled])

  const restartSession = useCallback(() => {
    if (!enabled) {
      return
    }
    activateSession()
  }, [activateSession, enabled])

  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return 0
    if (mode === "active") {
      return Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000))
    }
    // results or landing (after end)
    const planned = configuredSeconds
    return Math.min(planned, Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)))
  }, [startedAt, mode, configuredSeconds])

  const persistSession = useCallback(async (finished: boolean) => {
    const currentLessonId = lessonIdRef.current
    const segmentStart = startedAtRef.current
    if (!currentLessonId || !segmentStart) return

    if (!runIdRef.current) {
      runIdRef.current = createRunId(currentLessonId)
    }

    const endedAt = Date.now()
    const fallbackTitle = lessonTitleRef.current?.trim()?.length
      ? (lessonTitleRef.current as string)
      : currentLessonId
    const plannedSeconds = configuredSecondsRef.current ?? DEFAULT_SESSION_SECONDS
    const speed = speedRef.current ?? ((1.0 as PlaybackSpeed))

    await saveLearningSession({
      lessonId: currentLessonId,
      lessonTitle: fallbackTitle,
      startedAt: segmentStart.getTime(),
      endedAt,
      plannedSeconds,
      speed,
      finished,
      runId: runIdRef.current ?? undefined,
      segments: 1,
    })
  }, [])

  // On results mode entry, persist session once
  const hasSavedRef = useRef(false)
  useEffect(() => {
    if (!enabled) {
      return
    }

    if (mode === "results" && !hasSavedRef.current) {
      hasSavedRef.current = true
      // If session ended naturally, finished=true
      persistSession(remainingSeconds === 0)
    }
    if (mode !== "results") {
      hasSavedRef.current = false
    }
  }, [mode, persistSession, remainingSeconds, enabled])

  // Save session on manual exit (unfinished)
  useEffect(() => {
    if (!enabled) {
      return
    }
    if (mode === "active") {
      return () => {
        if (startedAtRef.current) {
          if (finishingRef.current) {
            finishingRef.current = false
            return
          }
          void persistSession(false)
        }
      }
    }
    return undefined
  }, [mode, persistSession, enabled])

  useEffect(() => () => stopTimer(), [stopTimer])

  useEffect(
    () => () => {
      runIdRef.current = null
      finishingRef.current = false
      startedAtRef.current = null
    },
    []
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    if (sessionReady && mode === "landing") {
      startSession()
    }
  }, [sessionReady, mode, startSession, enabled])

  return {
    mode: enabled ? mode : "active",
    configuredSeconds,
    remainingSeconds: enabled ? remainingSeconds : 0,
    elapsedSeconds: enabled ? elapsedSeconds : 0,
    startSession: enabled ? startSession : () => {},
    restartSession: enabled ? restartSession : () => {},
    sessionReady: enabled ? sessionReady : true,
  }
}

export function formatSecondsMMSS(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}
