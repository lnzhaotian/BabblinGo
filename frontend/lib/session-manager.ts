import AsyncStorage from "@react-native-async-storage/async-storage"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"
import { scheduleLearningRecordSync } from "@/lib/learning-sync"
import type { SessionRecord } from "./learning-types"
import { LEARNING_SESSIONS_STORAGE_KEY } from "./learning-types"

/**
 * Learning preferences structure
 */
export interface LearningPreferences {
  sessionLength: number // seconds
  playbackSpeed: PlaybackSpeed
}

/**
 * Default preferences
 */
const DEFAULT_PREFERENCES: LearningPreferences = {
  sessionLength: 600, // 10 minutes
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
    const [[, lengthStr], [, speedStr]] = await AsyncStorage.multiGet([
      "learning.sessionLength",
      "learning.playbackSpeed",
    ])

    const sessionLength =
      lengthStr != null ? parseInt(lengthStr, 10) : DEFAULT_PREFERENCES.sessionLength
    const playbackSpeed =
      speedStr != null ? (parseFloat(speedStr) as PlaybackSpeed) : DEFAULT_PREFERENCES.playbackSpeed

    return {
      sessionLength: !isNaN(sessionLength) ? sessionLength : DEFAULT_PREFERENCES.sessionLength,
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
    const entries: [string, string][] = []

    if (preferences.sessionLength != null) {
      entries.push(["learning.sessionLength", String(preferences.sessionLength)])
    }
    if (preferences.playbackSpeed != null) {
      entries.push(["learning.playbackSpeed", String(preferences.playbackSpeed)])
    }

    await AsyncStorage.multiSet(entries)
  } catch (error) {
    console.error("Failed to save learning preferences:", error)
    throw error
  }
}

/**
 * Save a learning session record to AsyncStorage
 * Only saves if duration meets minimum threshold
 */
export async function saveLearningSession(record: Omit<SessionRecord, "id">): Promise<void> {
  try {
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

    const normalizedLessonTitle = record.lessonTitle?.trim().length ? record.lessonTitle : record.lessonId;
    const baseSession: SessionRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      ...record,
      lessonTitle: normalizedLessonTitle,
      durationSeconds: segmentDurationSeconds,
      segments: record.segments ?? 1,
      dirty: true,
      syncedAt: undefined,
      serverId: undefined,
      lastModifiedAt: Date.now(),
    };

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
        };

        sessions[existingIndex] = merged;
        await AsyncStorage.setItem(key, JSON.stringify(sessions));
        console.log(
          `Updated aggregated session ${record.runId}: +${segmentDurationSeconds}s (segments=${merged.segments}, total=${merged.durationSeconds}s)`
        );
        scheduleLearningRecordSync().catch(() => {
          // already logged inside scheduler
        });
        return;
      }
    }

    sessions.push(baseSession);
    await AsyncStorage.setItem(key, JSON.stringify(sessions));

    console.log(
      `Saved learning session: ${segmentDurationSeconds}s for ${normalizedLessonTitle} (finished: ${record.finished}, runId: ${record.runId ?? "-"})`
    );
    scheduleLearningRecordSync().catch(() => {
      // already logged inside scheduler
    });
  } catch (error) {
    console.error("Failed to save learning session:", error);
    // Don't throw - session saving is not critical
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
