import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"

export interface SessionRecord {
  id: string
  lessonId: string
  lessonTitle: string
  startedAt: number
  endedAt: number
  plannedSeconds: number
  speed: PlaybackSpeed
  finished: boolean
  runId?: string
  durationSeconds?: number
  segments?: number
  serverId?: string
  syncedAt?: number
  dirty?: boolean
  lastModifiedAt?: number
  remoteUpdatedAt?: number
}

export const LEARNING_SESSIONS_STORAGE_KEY = "learning.sessions"
