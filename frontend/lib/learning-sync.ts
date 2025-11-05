import AsyncStorage from "@react-native-async-storage/async-storage"
import { config } from "./config"
import {
  recordLearningSyncCompleted,
  recordLearningSyncFailed,
  recordLearningSyncSkipped,
  recordLearningSyncStarted,
} from "./analytics"
import type { LearningSyncFetchStatus } from "./analytics"
import type { SessionRecord } from "./learning-types"
import { LEARNING_SESSIONS_STORAGE_KEY } from "./learning-types"
import { clearAuthSession, getAuthToken } from "./auth-session"

const ENDPOINT = `${config.apiUrl}/api/learning-records`
let inFlight: Promise<void> | null = null

const headersFor = (token: string, includeJson = false) => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  }
  if (includeJson) {
    headers["Content-Type"] = "application/json"
  }
  return headers
}

const toISOString = (value: number) => {
  try {
    return new Date(value).toISOString()
  } catch {
    return new Date().toISOString()
  }
}

const safeNumber = (value: unknown, fallback: number) => {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

const normalizeSpeed = (value: unknown) => {
  const num = safeNumber(value, 1)
  if (num <= 0.25) return 0.25
  if (num >= 3) return 3
  return Number(num.toFixed(2))
}

const countDirtySessions = (sessions: SessionRecord[]): number =>
  sessions.reduce((acc, session) => acc + ((session.dirty || !session.serverId) ? 1 : 0), 0)

type RemoteRecord = {
  id: string
  clientId?: string
  lessonId?: string
  lessonTitle?: string | null
  runId?: string | null
  startedAt?: string | null
  endedAt?: string | null
  plannedSeconds?: number | null
  durationSeconds?: number | null
  speed?: number | null
  finished?: boolean | null
  segments?: number | null
  updatedAt?: string | null
}

type RemoteFetchResult = {
  records: SessionRecord[]
  status: LearningSyncFetchStatus
  statusCode?: number
  errorMessage?: string
}

type PushResult = {
  sessions: SessionRecord[]
  attempted: number
  failed: number
  succeeded: number
  unauthorized: boolean
  statusCode?: number
  errorMessage?: string
}

const fromRemoteRecord = (doc: RemoteRecord): SessionRecord | null => {
  const clientId = doc.clientId || doc.id
  const lessonId = doc.lessonId || ""
  if (!clientId || !lessonId) {
    return null
  }

  const startedAt = doc.startedAt ? Date.parse(doc.startedAt) : Date.now()
  const endedAt = doc.endedAt ? Date.parse(doc.endedAt) : startedAt
  const durationSeconds = doc.durationSeconds != null ? doc.durationSeconds : Math.max(0, Math.floor((endedAt - startedAt) / 1000))
  const remoteUpdatedAt = doc.updatedAt ? Date.parse(doc.updatedAt) : undefined

  return {
    id: clientId,
    lessonId,
    lessonTitle: (doc.lessonTitle && doc.lessonTitle.trim().length ? doc.lessonTitle : lessonId) ?? lessonId,
    startedAt,
    endedAt,
    plannedSeconds: doc.plannedSeconds ?? durationSeconds,
    speed: normalizeSpeed(doc.speed ?? 1) as SessionRecord["speed"],
    finished: doc.finished ?? false,
    runId: doc.runId ?? undefined,
    durationSeconds,
    segments: doc.segments ?? 1,
    serverId: doc.id,
    syncedAt: remoteUpdatedAt ?? Date.now(),
    dirty: false,
    lastModifiedAt: remoteUpdatedAt,
    remoteUpdatedAt,
  }
}

const toPayload = (record: SessionRecord) => {
  return {
    clientId: record.id,
    lessonId: record.lessonId,
    lessonTitle: record.lessonTitle,
    runId: record.runId ?? null,
    startedAt: toISOString(record.startedAt),
    endedAt: toISOString(record.endedAt),
    plannedSeconds: record.plannedSeconds ?? 0,
    durationSeconds: record.durationSeconds ?? Math.max(0, Math.floor((record.endedAt - record.startedAt) / 1000)),
    speed: Number(record.speed),
    finished: !!record.finished,
    segments: record.segments ?? 1,
  }
}

async function fetchRemoteRecords(token: string): Promise<RemoteFetchResult> {
  try {
    const res = await fetch(`${ENDPOINT}?limit=250&sort=-updatedAt`, {
      headers: headersFor(token),
    })

    if (res.status === 401 || res.status === 403) {
      const message = await res.text().catch(() => '')
      console.warn("Learning record sync: unauthorized while fetching remote records", message)
      return {
        records: [],
        status: 'unauthorized',
        statusCode: res.status,
        errorMessage: message || `status ${res.status}`,
      }
    }

    if (!res.ok) {
      const message = await res.text().catch(() => '')
      console.warn("Learning record sync: remote fetch failed", res.status, message)
      return {
        records: [],
        status: 'error',
        statusCode: res.status,
        errorMessage: message || `status ${res.status}`,
      }
    }

    const data = await res.json()
    const docs: RemoteRecord[] = Array.isArray(data?.docs)
      ? data.docs
      : Array.isArray(data?.data)
        ? data.data
        : []

    const records = docs
      .map((doc) => fromRemoteRecord(doc))
      .filter((doc): doc is SessionRecord => Boolean(doc))

    return { records, status: 'ok' }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn("Learning record sync: remote fetch error", message)
    return { records: [], status: 'error', errorMessage: message }
  }
}

const mergeLocalAndRemote = (
  local: SessionRecord[],
  remote: SessionRecord[]
): SessionRecord[] => {
  const map = new Map<string, SessionRecord>()
  for (const session of local) {
    map.set(session.id, session)
  }

  for (const remoteRecord of remote) {
    const existing = map.get(remoteRecord.id)
    if (!existing) {
      map.set(remoteRecord.id, remoteRecord)
      continue
    }

    const localDirty = !!existing.dirty
    const localModified = existing.lastModifiedAt ?? existing.syncedAt ?? existing.endedAt
    const remoteModified = remoteRecord.remoteUpdatedAt ?? remoteRecord.syncedAt ?? remoteRecord.endedAt

    if (localDirty && localModified >= remoteModified) {
      map.set(existing.id, {
        ...existing,
        serverId: remoteRecord.serverId ?? remoteRecord.id,
        remoteUpdatedAt: remoteModified,
        syncedAt: existing.syncedAt ?? remoteModified,
      })
    } else {
      map.set(existing.id, {
        ...existing,
        ...remoteRecord,
        dirty: false,
      })
    }
  }

  return Array.from(map.values())
}

async function pushDirtySessions(token: string, sessions: SessionRecord[]): Promise<PushResult> {
  const updatedSessions = [...sessions]
  let attempted = 0
  let failed = 0
  let unauthorized = false
  let unauthorizedStatus: number | undefined
  let unauthorizedMessage: string | undefined

  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index]
    if (!(session.dirty || !session.serverId)) {
      continue
    }

    const payload = toPayload(session)
    const headers = headersFor(token, true)
    let response: Response | null = null
    let updatedSession = { ...session }

    attempted += 1

    try {
      if (session.serverId) {
        response = await fetch(`${ENDPOINT}/${session.serverId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(payload),
        })
        if (response.status === 404) {
          updatedSession.serverId = undefined
          response = null
        }
      }

      if (!response) {
        response = await fetch(ENDPOINT, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        })
      }

      if (!response) {
        throw new Error("Learning record sync: no response received")
      }

      if (response.status === 401 || response.status === 403) {
        unauthorized = true
        unauthorizedStatus = response.status
        unauthorizedMessage = await response.text().catch(() => "")
        throw new Error("unauthorized")
      }

      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || "Failed to sync learning record")
      }

      const body = await response.json()
      const doc = body?.doc ?? body
      const serverId: string | undefined = doc?.id ?? doc?._id ?? updatedSession.serverId
      const remoteUpdatedAt = doc?.updatedAt ? Date.parse(doc.updatedAt) : Date.now()

      updatedSession = {
        ...updatedSession,
        serverId,
        syncedAt: Date.now(),
        remoteUpdatedAt,
        dirty: false,
      }
    } catch (error) {
      console.warn(`Learning record sync: push failed for ${session.id}`, error)
      updatedSession = {
        ...updatedSession,
        dirty: true,
      }
      failed += 1
    }

    updatedSessions[index] = updatedSession

    if (unauthorized) {
      break
    }
  }

  const succeeded = Math.max(0, attempted - failed)

  return {
    sessions: updatedSessions,
    attempted,
    failed,
    succeeded,
    unauthorized,
    statusCode: unauthorizedStatus,
    errorMessage: unauthorizedMessage,
  }
}

async function persistSessions(sessions: SessionRecord[]): Promise<void> {
  try {
    const existingRaw = await AsyncStorage.getItem(LEARNING_SESSIONS_STORAGE_KEY)
    const existing: SessionRecord[] = existingRaw ? JSON.parse(existingRaw) : []

    const map = new Map<string, SessionRecord>()
    for (const session of existing) {
      map.set(session.id, session)
    }
    for (const session of sessions) {
      map.set(session.id, session)
    }

    const merged = Array.from(map.values())
    merged.sort((a, b) => b.startedAt - a.startedAt)

    await AsyncStorage.setItem(LEARNING_SESSIONS_STORAGE_KEY, JSON.stringify(merged))
  } catch (error) {
    console.warn("Learning record sync: failed to persist", error)
  }
}

export async function syncLearningRecords(): Promise<void> {
  const startedAt = Date.now()

  const raw = await AsyncStorage.getItem(LEARNING_SESSIONS_STORAGE_KEY)
  const localSessions: SessionRecord[] = raw ? JSON.parse(raw) : []
  const localCount = localSessions.length
  const dirtyBefore = countDirtySessions(localSessions)

  const token = await getAuthToken()
  if (!token) {
    recordLearningSyncSkipped({
      reason: "unauthenticated",
      localCount,
      dirtyCount: dirtyBefore,
    })
    return
  }

  recordLearningSyncStarted({
    localCount,
    dirtyCount: dirtyBefore,
  })

  const fetchResult = await fetchRemoteRecords(token)

  if (fetchResult.status === 'unauthorized') {
    await clearAuthSession()
    recordLearningSyncFailed({
      durationMs: Date.now() - startedAt,
      localCount,
      dirtyBefore,
      errorMessage: fetchResult.errorMessage ?? 'unauthorized',
      stage: 'fetch',
      statusCode: fetchResult.statusCode,
    })
    return
  }

  const remoteSessions = fetchResult.records
  const mergedAfterRemote = mergeLocalAndRemote(localSessions, remoteSessions)
  const pushResult = await pushDirtySessions(token, mergedAfterRemote)
  if (pushResult.unauthorized) {
    await clearAuthSession()
    recordLearningSyncFailed({
      durationMs: Date.now() - startedAt,
      localCount: mergedAfterRemote.length,
      dirtyBefore,
      errorMessage: pushResult.errorMessage ?? 'unauthorized',
      stage: 'push',
      statusCode: pushResult.statusCode,
    })
    return
  }
  const merged = pushResult.sessions

  await persistSessions(merged)

  const dirtyAfter = countDirtySessions(merged)

  recordLearningSyncCompleted({
    durationMs: Date.now() - startedAt,
    localCount: merged.length,
    dirtyBefore,
    dirtyAfter,
    remoteFetched: remoteSessions.length,
    pushAttempted: pushResult.attempted,
    pushFailed: pushResult.failed,
    fetchStatus: fetchResult.status,
    fetchError: fetchResult.errorMessage,
  })
}

export function scheduleLearningRecordSync(): Promise<void> {
  if (!inFlight) {
    inFlight = syncLearningRecords()
      .catch((error) => {
        console.warn("Learning record sync failed", error)
      })
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}
