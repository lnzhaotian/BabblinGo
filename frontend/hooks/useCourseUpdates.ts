import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CourseDoc } from '@/lib/payload';

const STORAGE_KEY = 'course_updates_seen';

export function useCourseUpdates() {
  const [seenTimestamps, setSeenTimestamps] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSeenTimestamps();
  }, []);

  const loadSeenTimestamps = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        setSeenTimestamps(JSON.parse(json));
      }
    } catch (error) {
      console.error('Failed to load course update status', error);
    }
  };

  const markCourseAsSeen = useCallback(async (courseId: string, timestamp?: string) => {
    if (!timestamp) return;
    
    try {
      setSeenTimestamps(prev => {
        // Only update if the new timestamp is actually newer
        if (prev[courseId] === timestamp) return prev;
        
        const next = { ...prev, [courseId]: timestamp };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    } catch (error) {
      console.error('Failed to save course update status', error);
    }
  }, []);

  const hasUpdates = useCallback((course: CourseDoc) => {
    if (!course.updatedAt) return false;
    const lastSeen = seenTimestamps[course.id];
    
    // If we haven't seen it yet, it's "new" (has updates)
    if (!lastSeen) return true;
    
    // If the remote timestamp is newer than what we saw
    return new Date(course.updatedAt) > new Date(lastSeen);
  }, [seenTimestamps]);

  return {
    hasUpdates,
    markCourseAsSeen
  };
}
