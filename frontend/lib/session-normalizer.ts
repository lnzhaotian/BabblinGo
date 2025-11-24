import type { SessionRecord } from "./learning-types"

const MIN_TIME_GAP_MS = 1000
const MIN_SPEED = 0.25
const MAX_SPEED = 3
const MAX_SEGMENTS = 24

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const coerceTimestampMs = (value: unknown): number | null => {
  if (isFiniteNumber(value)) {
    return value
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime()
  }
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return null

    const parsedDate = Date.parse(trimmed)
    if (Number.isFinite(parsedDate)) {
      return parsedDate
    }

    const parsedNumber = Number(trimmed)
    if (Number.isFinite(parsedNumber)) {
      return parsedNumber
    }
  }
  return null
}

const normalizeNotes = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null
  }
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.length > 1000 ? trimmed.slice(0, 1000) : trimmed
}

const clampSpeed = (value: unknown): SessionRecord["speed"] => {
  if (!isFiniteNumber(value)) {
    return 1 as SessionRecord["speed"]
  }
  const clamped = Math.min(MAX_SPEED, Math.max(MIN_SPEED, value))
  return Number(clamped.toFixed(2)) as SessionRecord["speed"]
}

const normalizeSegments = (value: unknown): number => {
  if (!isFiniteNumber(value) || value <= 0) {
    return 1
  }
  return Math.min(MAX_SEGMENTS, Math.round(value))
}

export const normalizeSessionRecord = (session: SessionRecord): SessionRecord => {
  const updates: Partial<SessionRecord> = {}
  let changed = false

  const apply = <K extends keyof SessionRecord>(key: K, value: SessionRecord[K]) => {
    if (session[key] !== value) {
      updates[key] = value
      changed = true
    }
  }

  const now = Date.now()
  const startedAt = coerceTimestampMs(session.startedAt) ?? now
  let endedAt = coerceTimestampMs(session.endedAt)
  if (endedAt == null || endedAt <= startedAt) {
    endedAt = startedAt + MIN_TIME_GAP_MS
  }

  const durationFromDiff = Math.max(0, Math.round((endedAt - startedAt) / 1000))
  const hasValidDuration = isFiniteNumber(session.durationSeconds) && session.durationSeconds >= 0
  const durationSeconds = hasValidDuration
    ? Math.round(session.durationSeconds as number)
    : durationFromDiff

  const hasValidPlanned = isFiniteNumber(session.plannedSeconds) && session.plannedSeconds >= 0
  const plannedSeconds = hasValidPlanned
    ? Math.round(session.plannedSeconds as number)
    : durationSeconds

  apply("source", session.source === "manual" ? "manual" : "auto")
  apply("notes", normalizeNotes(session.notes))
  apply("startedAt", startedAt)
  apply("endedAt", endedAt)
  apply("durationSeconds", durationSeconds)
  apply("plannedSeconds", plannedSeconds)
  apply("speed", clampSpeed(session.speed))
  apply("segments", normalizeSegments(session.segments ?? 1))

  return changed ? ({ ...session, ...updates } satisfies SessionRecord) : session
}
