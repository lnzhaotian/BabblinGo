import AsyncStorage from "@react-native-async-storage/async-storage"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"
import { scheduleLearningRecordSync } from "@/lib/learning-sync"
import type { SessionRecord } from "./learning-types"
import { LEARNING_SESSIONS_STORAGE_KEY } from "./learning-types"
import { normalizeSessionRecord } from "./session-normalizer"

/**
 * Learning preferences structure
 */
export interface LearningPreferences {
  playbackSpeed: PlaybackSpeed
}

/**
 * Default preferences
 */
const DEFAULT_PREFERENCES: LearningPreferences = {
  playbackSpeed: 1.0 as PlaybackSpeed,
}

/**
 * Minimum session duration to record (disabled for testing)
 * Set to >0 to enforce a minimum duration in seconds.
 */
export const MIN_SESSION_DURATION = 0

/**
 * Load learning preferences from AsyncStorage
 */
export async function loadLearningPreferences(): Promise<LearningPreferences> {
  try {
    const raw = await AsyncStorage.getItem("learning.playbackSpeed")
    const playbackSpeed =
      raw != null ? (parseFloat(raw) as PlaybackSpeed) : DEFAULT_PREFERENCES.playbackSpeed

    return {
      playbackSpeed: !isNaN(playbackSpeed) ? playbackSpeed : DEFAULT_PREFERENCES.playbackSpeed,
    }
  } catch (error) {
    console.error("Failed to load learning preferences:", error)
    return DEFAULT_PREFERENCES
  }
}

/**
 * Save learning preferences to AsyncStorage
 */
export async function saveLearningPreferences(
  preferences: Partial<LearningPreferences>
): Promise<void> {
  try {
    if (preferences.playbackSpeed != null) {
      await AsyncStorage.setItem("learning.playbackSpeed", String(preferences.playbackSpeed))
    }
  } catch (error) {
    console.error("Failed to save learning preferences:", error)
    throw error
  }
}

/**
 * Save a learning session record to AsyncStorage
 * Only saves if duration meets minimum threshold
 */
export async function saveLearningSession(
  record: Omit<SessionRecord, "id" | "source"> & {
    source?: SessionRecord["source"]
    notes?: string | null
    courseId?: string
    defaultTrackingEnabled?: boolean
  }
): Promise<void> {
  try {
    // Check tracking preferences
    const prefsRaw = await AsyncStorage.getItem("user.preferences")
    let shouldTrack = true

    if (prefsRaw) {
      const prefs = JSON.parse(prefsRaw)
      const globalEnabled = prefs.globalTrackingEnabled ?? true
      
      if (record.courseId) {
        const override = prefs.courseOverrides?.[record.courseId]
        if (typeof override === "boolean") {
          shouldTrack = override
        } else {
          shouldTrack = record.defaultTrackingEnabled ?? globalEnabled
        }
      } else {
        shouldTrack = globalEnabled
      }
    } else {
      shouldTrack = record.defaultTrackingEnabled ?? true
    }

    if (!shouldTrack) {
      console.log(`Tracking disabled. Skipping save.`)
      return
    }

    const rawDurationMs = record.endedAt - record.startedAt;
    const segmentDurationSeconds = Math.max(0, Math.floor(rawDurationMs / 1000));

    // Only save sessions that meet minimum duration
    if (MIN_SESSION_DURATION > 0 && segmentDurationSeconds < MIN_SESSION_DURATION) {
      console.log(
        `Session too short (${segmentDurationSeconds}s), not saving (min: ${MIN_SESSION_DURATION}s)`
      );
      return;
    }

    const key = LEARNING_SESSIONS_STORAGE_KEY;
    const raw = await AsyncStorage.getItem(key);
    const sessions: SessionRecord[] = raw ? JSON.parse(raw) : [];

  const sessionSource: SessionRecord["source"] = record.source === "manual" ? "manual" : "auto"
  const normalizedNotes = record.notes ?? null
  const { source: _ignoredSource, notes: _ignoredNotes, courseId: _ignoredCourseId, defaultTrackingEnabled: _ignoredDefaultTracking, ...rest } = record

    const normalizedLessonTitle = record.lessonTitle?.trim().length ? record.lessonTitle : record.lessonId;
    const baseSession: SessionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ...rest,
      lessonTitle: normalizedLessonTitle,
      durationSeconds: segmentDurationSeconds,
      segments: record.segments ?? 1,
      dirty: true,
      syncedAt: undefined,
      serverId: undefined,
      lastModifiedAt: Date.now(),
      source: sessionSource,
      notes: normalizedNotes,
    };

    const normalizedBase = normalizeSessionRecord(baseSession);

    if (record.runId) {
      const existingIndex = sessions.findIndex((session) => session.runId === record.runId);
      if (existingIndex >= 0) {
        const existing = sessions[existingIndex];
        const existingDuration = existing.durationSeconds ?? Math.max(0, Math.floor((existing.endedAt - existing.startedAt) / 1000));
        const merged: SessionRecord = {
          ...existing,
          lessonTitle: normalizedLessonTitle,
          startedAt: Math.min(existing.startedAt, record.startedAt),
          endedAt: Math.max(existing.endedAt, record.endedAt),
          plannedSeconds: (existing.plannedSeconds ?? 0) + (record.plannedSeconds ?? 0),
          speed: record.speed,
          finished: existing.finished && record.finished,
          runId: record.runId,
          durationSeconds: existingDuration + segmentDurationSeconds,
          segments: (existing.segments ?? 1) + (record.segments ?? 1),
          dirty: true,
          lastModifiedAt: Date.now(),
          source: existing.source ?? sessionSource,
          notes: existing.notes ?? normalizedNotes,
        };

        sessions[existingIndex] = normalizeSessionRecord(merged);
        const normalizedSessions = sessions.map((session) => normalizeSessionRecord(session));
        await AsyncStorage.setItem(key, JSON.stringify(normalizedSessions));
        console.log(
          `Updated aggregated session ${record.runId}: +${segmentDurationSeconds}s (segments=${merged.segments}, total=${merged.durationSeconds}s)`
        );
        scheduleLearningRecordSync().catch(() => {
          // already logged inside scheduler
        });
        return;
      }
    }

  sessions.push(normalizedBase);
  const normalizedSessions = sessions.map((session) => normalizeSessionRecord(session));
    await AsyncStorage.setItem(key, JSON.stringify(normalizedSessions));

    console.log(
      `Saved learning session: ${segmentDurationSeconds}s for ${normalizedLessonTitle} (finished: ${record.finished}, runId: ${record.runId ?? "-"})`
    );
    if (sessionSource === "manual") {
      console.log("[session-manager] manual session stored", {
        id: normalizedBase.id,
        lessonId: normalizedBase.lessonId,
        startedAtMs: normalizedBase.startedAt,
        startedAtIso: Number.isFinite(normalizedBase.startedAt)
          ? new Date(normalizedBase.startedAt).toISOString()
          : null,
        endedAtMs: normalizedBase.endedAt,
        endedAtIso: Number.isFinite(normalizedBase.endedAt)
          ? new Date(normalizedBase.endedAt).toISOString()
          : null,
        durationSeconds: normalizedBase.durationSeconds,
      });
    }
    scheduleLearningRecordSync().catch(() => {
      // already logged inside scheduler
    });
  } catch (error) {
    console.error("Failed to save learning session:", error);
    // Don't throw - session saving is not critical
  }
}

/**
 * Update an existing learning session record
 */
export async function updateLearningSession(
  id: string,
  updates: Partial<Omit<SessionRecord, "id" | "serverId" | "syncedAt" | "remoteUpdatedAt">>
): Promise<void> {
  try {
    const key = LEARNING_SESSIONS_STORAGE_KEY
    const raw = await AsyncStorage.getItem(key)
    const sessions: SessionRecord[] = raw ? JSON.parse(raw) : []
    
    const index = sessions.findIndex(s => s.id === id)
    if (index === -1) {
      throw new Error(`Session record not found: ${id}`)
    }

    const existing = sessions[index]
    const updated: SessionRecord = {
      ...existing,
      ...updates,
      dirty: true,
      lastModifiedAt: Date.now(),
    }

    // Recalculate duration if start/end times changed
    if (updates.startedAt || updates.endedAt) {
      const start = updates.startedAt ?? existing.startedAt
      const end = updates.endedAt ?? existing.endedAt
      updated.durationSeconds = Math.max(0, Math.floor((end - start) / 1000))
    }

    sessions[index] = normalizeSessionRecord(updated)
    await AsyncStorage.setItem(key, JSON.stringify(sessions))
    
    scheduleLearningRecordSync().catch(() => {
      // already logged inside scheduler
    })
  } catch (error) {
    console.error("Failed to update learning session:", error)
    throw error
  }
}

/**
 * Get all learning sessions from AsyncStorage
 */
export async function getLearningSessions(): Promise<SessionRecord[]> {
  try {
    const key = LEARNING_SESSIONS_STORAGE_KEY
    const raw = await AsyncStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch (error) {
    console.error("Failed to load learning sessions:", error)
    return []
  }
}

/**
 * Clear all learning sessions (for testing/debugging)
 */
export async function clearLearningSessions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEARNING_SESSIONS_STORAGE_KEY)
    console.log("Cleared all learning sessions")
  } catch (error) {
    console.error("Failed to clear learning sessions:", error)
    throw error
  }
}
