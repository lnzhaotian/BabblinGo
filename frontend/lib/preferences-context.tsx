import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { getAuthToken } from "@/lib/auth-session"
import { config } from "@/lib/config"
import type { UserPreferencesDoc } from "@/lib/payload"

const PREFERENCES_STORAGE_KEY = "user.preferences"
const LEGACY_SPEED_KEY = "learning.playbackSpeed"

type PreferencesState = {
  globalTrackingEnabled: boolean
  playbackSpeed: number
  sessionDuration: number
  courseOverrides: Record<string, boolean> // courseId -> trackingEnabled
  loading: boolean
}

type PreferencesContextType = PreferencesState & {
  updateGlobal: (settings: { playbackSpeed?: number; sessionDuration?: number }) => Promise<void>
  setGlobalTrackingEnabled: (enabled: boolean) => Promise<void>
  setCourseTracking: (courseId: string, enabled: boolean) => Promise<void>
  refresh: () => Promise<void>
}

const DEFAULT_PREFERENCES: PreferencesState = {
  globalTrackingEnabled: true,
  playbackSpeed: 1.0,
  sessionDuration: 900,
  courseOverrides: {},
  loading: true,
}

const PreferencesContext = createContext<PreferencesContextType | null>(null)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PreferencesState>(DEFAULT_PREFERENCES)
  const userIdRef = React.useRef<string | null>(null)

  const getUserId = useCallback(async (token: string) => {
    if (userIdRef.current) return userIdRef.current
    try {
      const res = await fetch(`${config.apiUrl}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.user?.id) {
          userIdRef.current = data.user.id
          return data.user.id
        }
      }
    } catch (e) {
      console.warn("Failed to fetch user ID", e)
    }
    return null
  }, [])

  const loadFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        setState((prev) => ({ ...prev, ...parsed, loading: false }))
        return parsed
      }
    } catch (e) {
      console.warn("Failed to load preferences from storage", e)
    }
    return null
  }, [])

  const syncToServer = useCallback(async (newState: PreferencesState) => {
    const token = await getAuthToken()
    if (!token) return

    try {
      // Convert state to payload format
      const overridesArray = Object.entries(newState.courseOverrides).map(([courseId, enabled]) => ({
        course: courseId,
        trackingEnabled: enabled,
      }))

      const payload = {
        global: {
          trackingEnabled: newState.globalTrackingEnabled,
          playbackSpeed: newState.playbackSpeed,
          sessionDuration: newState.sessionDuration,
        },
        courseOverrides: overridesArray,
      }

      const userId = await getUserId(token)
      const query = new URLSearchParams({
        limit: '1',
      })
      if (userId) {
        query.set('where[user][equals]', userId)
      }

      const res = await fetch(`${config.apiUrl}/api/user-preferences?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      if (res.ok) {
        const data = await res.json()
        const existing = data.docs?.[0] as UserPreferencesDoc | undefined

        const method = existing ? "PATCH" : "POST"
        const url = existing 
          ? `${config.apiUrl}/api/user-preferences/${existing.id}`
          : `${config.apiUrl}/api/user-preferences`

        await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })
      }
    } catch (e) {
      console.warn("Failed to sync preferences to server", e)
    }
  }, [getUserId])

  const refresh = useCallback(async () => {
    const token = await getAuthToken()
    if (!token) return

    try {
      const userId = await getUserId(token)
      const query = new URLSearchParams({
        limit: '1',
      })
      if (userId) {
        query.set('where[user][equals]', userId)
      }

      const res = await fetch(`${config.apiUrl}/api/user-preferences?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })

      if (res.ok) {
        const data = await res.json()
        const doc = data.docs?.[0] as UserPreferencesDoc | undefined

        if (doc) {
          const overrides: Record<string, boolean> = {}
          doc.courseOverrides?.forEach((o) => {
            const cId = typeof o.course === 'string' ? o.course : o.course.id
            overrides[cId] = o.trackingEnabled
          })

          const newState = {
            globalTrackingEnabled: doc.global?.trackingEnabled ?? true,
            playbackSpeed: doc.global?.playbackSpeed ?? 1.0,
            sessionDuration: doc.global?.sessionDuration ?? 900,
            courseOverrides: overrides,
            loading: false,
          }

          setState(newState)
          await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(newState))
        }
      }
    } catch (e) {
      console.warn("Failed to refresh preferences", e)
    }
  }, [getUserId])

  const migrateLegacy = useCallback(async () => {
    try {
      const legacySpeed = await AsyncStorage.getItem(LEGACY_SPEED_KEY)
      if (legacySpeed) {
        const speed = parseFloat(legacySpeed)
        if (!isNaN(speed)) {
          setState((prev) => {
            const next = { ...prev, playbackSpeed: speed }
            AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next))
            syncToServer(next)
            return next
          })
        }
        await AsyncStorage.removeItem(LEGACY_SPEED_KEY)
      }
    } catch (e) {
      console.warn("Failed to migrate legacy preferences", e)
    }
  }, [syncToServer])

  useEffect(() => {
    loadFromStorage().then((loaded) => {
      if (!loaded) {
        migrateLegacy()
      }
      refresh()
    })
  }, [loadFromStorage, refresh, migrateLegacy])

  const updateGlobal = useCallback(async (settings: { playbackSpeed?: number; sessionDuration?: number }) => {
    setState((prev) => {
      const next = { ...prev, ...settings }
      AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next))
      syncToServer(next)
      return next
    })
  }, [syncToServer])

  const setGlobalTrackingEnabled = useCallback(async (enabled: boolean) => {
    setState((prev) => {
      const next = { ...prev, globalTrackingEnabled: enabled }
      AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next))
      syncToServer(next)
      return next
    })
  }, [syncToServer])

  const setCourseTracking = useCallback(async (courseId: string, enabled: boolean) => {
    setState((prev) => {
      const next = {
        ...prev,
        courseOverrides: {
          ...prev.courseOverrides,
          [courseId]: enabled,
        },
      }
      AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(next))
      syncToServer(next)
      return next
    })
  }, [syncToServer])

  return (
    <PreferencesContext.Provider value={{ ...state, updateGlobal, setGlobalTrackingEnabled, setCourseTracking, refresh }}>
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider")
  }
  return context
}
