import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { saveLearningSession } from "@/lib/session-manager"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"

export type LearningSessionMode = "landing" | "active" | "results"

const createRunId = (lessonId?: string) =>
  `${lessonId ?? "lesson"}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

type LearningSessionOptions = {
  defaultSeconds?: number
  speed?: PlaybackSpeed
  loop?: boolean
  enabled?: boolean
}

export function useLearningSession(
  lessonId: string | undefined,
  lessonTitle: string | undefined,
  opts?: LearningSessionOptions
) {
  const enabled = opts?.enabled ?? true
  const passiveMode = !enabled

    const [mode, setMode] = useState<LearningSessionMode>("active")
  const [startedAt, setStartedAt] = useState<Date | null>(null)
    const sessionReady = true
  const lessonIdRef = useRef<string | undefined>(lessonId)
  const runIdRef = useRef<string | null>(null)
  const finishingRef = useRef(false)
  const lessonTitleRef = useRef<string | undefined>(lessonTitle)
  const speedRef = useRef<PlaybackSpeed>(opts?.speed ?? (1.0 as PlaybackSpeed))
  const startedAtRef = useRef<Date | null>(startedAt)

  useEffect(() => {
    lessonTitleRef.current = lessonTitle
  }, [lessonTitle])

  useEffect(() => {
    lessonIdRef.current = lessonId
  }, [lessonId])

  useEffect(() => {
    if (opts?.speed) {
      speedRef.current = opts.speed
    }
  }, [opts?.speed])

  useEffect(() => {
    startedAtRef.current = startedAt
  }, [startedAt])

  const activateSession = useCallback(() => {
    if (!runIdRef.current) {
      runIdRef.current = createRunId(lessonId)
    }
    finishingRef.current = false
    const startTime = new Date()
    setMode("active")
    setStartedAt(startTime)
    startedAtRef.current = startTime
    }, [lessonId])

  // Ensure a session starts for enabled modules (e.g., audioSlideshow) even after removing countdown logic
  useEffect(() => {
    if (enabled && !startedAtRef.current) {
      activateSession()
    }
  }, [enabled, activateSession])

  const startSession = useCallback(() => {
    if (mode === "active") {
      return
    }
    activateSession()
    }, [activateSession, mode])

  const restartSession = useCallback(() => {
    activateSession()
    }, [activateSession])

  const elapsedSeconds = useMemo(() => {
    if (!startedAt) return 0
      return Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000))
    }, [startedAt])

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
      const actualSeconds = Math.max(0, Math.round((endedAt - segmentStart.getTime()) / 1000))
    const speed = speedRef.current ?? ((1.0 as PlaybackSpeed))

    await saveLearningSession({
      lessonId: currentLessonId,
      lessonTitle: fallbackTitle,
      startedAt: segmentStart.getTime(),
      endedAt,
        plannedSeconds: actualSeconds, // Use actual time as planned time
      speed,
      finished,
      runId: runIdRef.current ?? undefined,
      segments: 1,
    })
  }, [])

  // On results mode entry, persist session once
  const hasSavedRef = useRef(false)
  useEffect(() => {
      if (mode === "results" && !hasSavedRef.current) {
      hasSavedRef.current = true
        persistSession(true)
    }
    if (mode !== "results") {
      hasSavedRef.current = false
    }
    }, [mode, persistSession])

  // Save session on manual exit (unfinished)
  useEffect(() => {
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
    }, [mode, persistSession])

  useEffect(
    () => () => {
      runIdRef.current = null
      finishingRef.current = false
      startedAtRef.current = null
    },
    []
  )

  useEffect(() => {
    if (!passiveMode) {
      return
    }
    if (!lessonIdRef.current && lessonId) {
      lessonIdRef.current = lessonId
    }
    if (!runIdRef.current && lessonIdRef.current) {
      runIdRef.current = createRunId(lessonIdRef.current)
    }
    if (!startedAtRef.current) {
      const startTime = new Date()
      startedAtRef.current = startTime
      setStartedAt(startTime)
    }
  }, [passiveMode, lessonId])

    // Auto-start session when enabled
    useEffect(() => {
      if (enabled && !startedAt) {
        startSession()
      }
    }, [enabled, startedAt, startSession])

  return {
      mode,
      configuredSeconds: 0, // No longer used, kept for compatibility
      remainingSeconds: 0, // No longer used, kept for compatibility
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
