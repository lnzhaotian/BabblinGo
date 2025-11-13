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
import { LEARNING_SESSIONS_STORAGE_KEY, LEARNING_SESSIONS_IGNORED_IDS_KEY } from "./learning-types"
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

// Local ignore list (tombstones) for records the user deleted but server refused.
async function loadIgnoredIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(LEARNING_SESSIONS_IGNORED_IDS_KEY)
    const arr: string[] = raw ? JSON.parse(raw) : []
    return new Set(arr)
  } catch {
    return new Set()
  }
}

async function saveIgnoredIds(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(LEARNING_SESSIONS_IGNORED_IDS_KEY, JSON.stringify(Array.from(ids)))
  } catch (e) {
    console.warn("[learning] failed to persist ignored ids", e)
  }
}

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

    const ignored = await loadIgnoredIds()
    const records = docs
      .map((doc) => fromRemoteRecord(doc))
      .filter((doc): doc is SessionRecord => Boolean(doc))
      .filter((rec) => {
        const drop = ignored.has(rec.id) || (rec.serverId ? ignored.has(rec.serverId) : false)
        if (drop) {
          console.log("[learning] fetchRemoteRecords:ignored-remote", { id: rec.id, serverId: rec.serverId })
        }
        return !drop
      })

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

// Delete a single learning record locally by client id
async function deleteLocalRecordById(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LEARNING_SESSIONS_STORAGE_KEY)
    const arr: SessionRecord[] = raw ? JSON.parse(raw) : []
    const next = arr.filter((s) => s.id !== id)
    await AsyncStorage.setItem(LEARNING_SESSIONS_STORAGE_KEY, JSON.stringify(next))
  } catch (e) {
    console.warn("Failed to delete local learning record", e)
  }
}

// Attempt to delete a single learning record on the server (if logged in), then remove locally
export async function deleteLearningRecord(id: string, serverIdOverride?: string): Promise<{
  ok: boolean
  remote: boolean
  unauthorized?: boolean
  statusCode?: number
  errorMessage?: string
}> {
  console.log("[learning] deleteLearningRecord:start", { id, providedServerId: !!serverIdOverride })
  // Look up the local record to get serverId if not provided
  const raw = await AsyncStorage.getItem(LEARNING_SESSIONS_STORAGE_KEY)
  const arr: SessionRecord[] = raw ? JSON.parse(raw) : []
  const rec = arr.find((s) => s.id === id)
  const serverId = serverIdOverride ?? rec?.serverId

  let remote = false
  let unauthorized = false
  let statusCode: number | undefined
  let errorMessage: string | undefined

  const token = await getAuthToken()
  if (token && serverId) {
    try {
      console.log("[learning] deleteLearningRecord:attempt-remote", { id, hasToken: !!token, serverId })
      const res = await fetch(`${ENDPOINT}/${serverId}`, {
        method: "DELETE",
        headers: headersFor(token),
      })
      statusCode = res.status
      if (res.status === 401 || res.status === 403) {
        unauthorized = true
        errorMessage = await res.text().catch(() => "")
        console.warn("[learning] deleteLearningRecord:unauthorized", { id, status: res.status, errorMessage })
      } else if (res.ok || res.status === 404) {
        // 404: treat as already deleted server-side
        remote = true
        console.log("[learning] deleteLearningRecord:remote-ok", { id, status: res.status })
      } else {
        errorMessage = await res.text().catch(() => `status ${res.status}`)
        console.warn("[learning] deleteLearningRecord:remote-failed", { id, status: res.status, errorMessage })
      }
    } catch (e) {
      errorMessage = e instanceof Error ? e.message : String(e)
      console.warn("[learning] deleteLearningRecord:remote-error", { id, errorMessage })
    }
  } else {
    console.log("[learning] deleteLearningRecord:skip-remote", { id, hasToken: !!token, hasServerId: !!serverId })
  }

  // Always delete locally regardless of remote outcome to respect user intent
  console.log("[learning] deleteLearningRecord:local-delete", { id })
  await deleteLocalRecordById(id)

  // Maintain tombstone if remote failed/unauthorized, remove tombstone if remote succeeded
  try {
    const ignored = await loadIgnoredIds()
    if (remote) {
      // ensure any tombstone is cleared
      ignored.delete(id)
      if (serverId) ignored.delete(serverId)
    } else {
      ignored.add(id)
      if (serverId) ignored.add(serverId)
    }
    await saveIgnoredIds(ignored)
  } catch (e) {
    console.warn("[learning] deleteLearningRecord:ignored-set-update-failed", e)
  }

  return {
    ok: true,
    remote,
    unauthorized,
    statusCode,
    errorMessage,
  }
}

// Clear all learning records both server-side (best-effort) and locally
export async function clearAllLearningRecords(): Promise<{
  ok: boolean
  remoteAttempted: boolean
  remoteDeleted: number
  unauthorized?: boolean
  statusCode?: number
  errorMessage?: string
}> {
  console.log("[learning] clearAllLearningRecords:start")
  const token = await getAuthToken()
  let remoteAttempted = false
  let remoteDeleted = 0
  let unauthorized = false
  let statusCode: number | undefined
  let errorMessage: string | undefined

  try {
    if (token) {
      remoteAttempted = true
      console.log("[learning] clearAllLearningRecords:has-token")
      // Try bulk delete endpoint first (DELETE /api/learning-records)
      let bulkResp: Response | null = null
      try {
        bulkResp = await fetch(ENDPOINT, {
          method: "DELETE",
          headers: headersFor(token),
        })
      } catch {
        // network or other failure, fall through to per-record
        bulkResp = null
      }

      if (bulkResp) {
        statusCode = bulkResp.status
        if (bulkResp.status === 401 || bulkResp.status === 403) {
          unauthorized = true
          errorMessage = await bulkResp.text().catch(() => "")
          console.warn("[learning] clearAllLearningRecords:unauthorized", { status: bulkResp.status, errorMessage })
        } else if (bulkResp.ok || bulkResp.status === 404 || bulkResp.status === 405) {
          // 404/405: treat as unsupported; we'll do per-record fallback
          if (bulkResp.ok) {
            // If server reports how many deleted, try to read it; otherwise assume success
            try {
              const json = await bulkResp.json().catch(() => null)
              if (json && typeof json.deleted === 'number') {
                remoteDeleted = json.deleted
              }
            } catch {}
            console.log("[learning] clearAllLearningRecords:bulk-ok", { deleted: remoteDeleted })
          }
        } else {
          errorMessage = await bulkResp.text().catch(() => `status ${bulkResp.status}`)
          console.warn("[learning] clearAllLearningRecords:bulk-failed", { status: bulkResp.status, errorMessage })
        }
      }

      // If bulk not ok or unsupported, fall back to deleting each known server record
      if (!unauthorized && (statusCode == null || !bulkResp || (!bulkResp.ok && bulkResp.status !== 404 && bulkResp.status !== 405))) {
        const raw = await AsyncStorage.getItem(LEARNING_SESSIONS_STORAGE_KEY)
        const arr: SessionRecord[] = raw ? JSON.parse(raw) : []
        const serverIds = arr.map((s) => s.serverId).filter((v): v is string => !!v)
        console.log("[learning] clearAllLearningRecords:fallback-per-record", { count: serverIds.length })
        for (const sid of serverIds) {
          try {
            const res = await fetch(`${ENDPOINT}/${sid}`, {
              method: "DELETE",
              headers: headersFor(token),
            })
            if (res.status === 401 || res.status === 403) {
              unauthorized = true
              statusCode = res.status
              errorMessage = await res.text().catch(() => "")
              break
            }
            if (res.ok || res.status === 404) {
              remoteDeleted += 1
            }
          } catch {
            // ignore per-item failure
          }
        }
        console.log("[learning] clearAllLearningRecords:fallback-result", { remoteDeleted })
      }
    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e)
  }

  // Always clear local storage
  try {
    await AsyncStorage.removeItem(LEARNING_SESSIONS_STORAGE_KEY)
    console.log("[learning] clearAllLearningRecords:local-cleared")
  } catch (e) {
    console.warn("Failed to clear local learning records", e)
  }

  // If remote wasn't allowed or failed, set tombstones for all known records to avoid resurrection on fetch
  try {
    if (unauthorized || (remoteAttempted && remoteDeleted === 0)) {
      const rawExisting = await AsyncStorage.getItem(LEARNING_SESSIONS_STORAGE_KEY)
      const arr: SessionRecord[] = rawExisting ? JSON.parse(rawExisting) : []
      const ids = new Set<string>()
      for (const s of arr) {
        ids.add(s.id)
        if (s.serverId) ids.add(s.serverId)
      }
      const ignored = await loadIgnoredIds()
      for (const v of ids) ignored.add(v)
      await saveIgnoredIds(ignored)
      console.log("[learning] clearAllLearningRecords:set-tombstones", { count: ids.size })
    }
  } catch (e) {
    console.warn("[learning] clearAllLearningRecords:tombstone-failed", e)
  }

  return { ok: true, remoteAttempted, remoteDeleted, unauthorized, statusCode, errorMessage }
}
