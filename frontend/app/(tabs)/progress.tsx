import React, { useCallback, useEffect, useMemo, useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { SectionList, View, Text, Pressable, ScrollView } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect } from "@react-navigation/native"
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler"
import { useTranslation } from "react-i18next"
import { fetchLessonById } from "@/lib/payload"
import { useThemeMode } from "../theme-context"

// Stored by lesson timer in lesson screen
// id, lessonId, lessonTitle, startedAt, endedAt, plannedSeconds, speed
interface SessionRecord {
  id: string
  lessonId: string
  lessonTitle: string
  startedAt: number
  endedAt: number
  plannedSeconds: number
  speed: number
  finished?: boolean // true if session completed planned time, false if exited early
}

const secToHMM = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const mm = String(m).padStart(2, "0")
  if (h > 0) return `${h}:${mm}h`
  return `${m}m`
}

const secToMMSS = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const withinLastNDays = (ms: number, days: number) => {
  const now = Date.now()
  const start = now - days * 24 * 60 * 60 * 1000
  return ms >= start
}
export default function ProgressScreen() {
  const { t, i18n } = useTranslation()
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "all">("7d")
  const [lessonFilter, setLessonFilter] = useState<string | "all">("all")
  const [titlesById, setTitlesById] = useState<Record<string, string>>({})
  const { colorScheme } = useThemeMode();

  const loadSessions = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("learning.sessions")
      const arr: SessionRecord[] = raw ? JSON.parse(raw) : []
      // newest first
      arr.sort((a, b) => b.startedAt - a.startedAt)
      setSessions(arr)
    } catch {}
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadSessions()
      return () => {}
    }, [loadSessions])
  )

  // Fetch localized lesson titles for current language
  useEffect(() => {
    const loadTitles = async () => {
      try {
        const ids = Array.from(new Set(sessions.map((s) => s.lessonId)))
        if (ids.length === 0) {
          setTitlesById({})
          return
        }
        const entries = await Promise.all(
          ids.map(async (id) => {
            try {
              const doc = await fetchLessonById(id, i18n.language)
              return [id, doc.title as string] as const
            } catch {
              // Fallback to existing saved title from the latest session with that id
              const saved = sessions.find((s) => s.lessonId === id)?.lessonTitle || id
              return [id, saved] as const
            }
          })
        )
        const map: Record<string, string> = {}
        for (const [id, title] of entries) map[id] = title
        setTitlesById(map)
      } catch {
        // ignore failures; fallbacks will handle
      }
    }
    loadTitles()
  }, [sessions, i18n.language])

  const summary = useMemo(() => {
    const now = new Date()
    let today = 0
    let week = 0
    let all = 0
    for (const s of sessions) {
      const dur = Math.max(0, Math.round((s.endedAt - s.startedAt) / 1000))
      all += dur
      const started = new Date(s.startedAt)
      if (isSameDay(started, now)) today += dur
      if (withinLastNDays(s.startedAt, 7)) week += dur
    }
    return { today, week, all }
  }, [sessions])

  const uniqueLessons = useMemo(() => {
    const map = new Map<string, string>()
    sessions.forEach((s) => {
      const title = titlesById[s.lessonId] || s.lessonTitle || s.lessonId
      if (!map.has(s.lessonId)) map.set(s.lessonId, title)
    })
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [sessions, titlesById])

  const filteredSessions = useMemo(() => {
    let arr = sessions
    if (timeframe === "7d") arr = arr.filter((s) => withinLastNDays(s.startedAt, 7))
    else if (timeframe === "30d") arr = arr.filter((s) => withinLastNDays(s.startedAt, 30))
    if (lessonFilter !== "all") arr = arr.filter((s) => s.lessonId === lessonFilter)
    return arr
  }, [sessions, timeframe, lessonFilter])

  // Weekly chart data (current week Monday -> Sunday). Respects lesson filter.
  const weekly = useMemo(() => {
    // Find Monday of current week
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    const dow = base.getDay() // 0=Sun..6=Sat
    const daysFromMonday = (dow + 6) % 7 // 0 if Mon
    const monday = new Date(base)
    monday.setDate(base.getDate() - daysFromMonday)

    const keys: ("mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun")[] = [
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat",
      "sun",
    ]

    const days: { label: string; total: number }[] = keys.map((k, idx) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + idx)
      const label = t(`common.weekdayShort.${k}`)
      const total = filteredSessions
        .filter((s) => isSameDay(new Date(s.startedAt), d))
        .reduce((acc, s) => acc + Math.max(0, Math.round((s.endedAt - s.startedAt) / 1000)), 0)
      return { label, total }
    })

    const max = Math.max(1, ...days.map((d) => d.total))
    return { days, max }
  }, [filteredSessions, t])

  const sections = useMemo(() => {
    const now = new Date()
    const today: SessionRecord[] = []
    const week: SessionRecord[] = []
    const earlier: SessionRecord[] = []

    for (const s of filteredSessions) {
      const started = new Date(s.startedAt)
      if (isSameDay(started, now)) today.push(s)
      else if (withinLastNDays(s.startedAt, 7)) week.push(s)
      else earlier.push(s)
    }

  const result: { title: string; data: SessionRecord[] }[] = []
    if (today.length) result.push({ title: "Today", data: today })
    if (week.length) result.push({ title: "This Week", data: week })
    if (earlier.length) result.push({ title: "Earlier", data: earlier })
    return result
  }, [filteredSessions])

  const perLessonRollups = useMemo(() => {
    const map = new Map<string, { title: string; total: number; sessions: number }>()
    for (const s of filteredSessions) {
      const key = s.lessonId
      const displayTitle = titlesById[key] || s.lessonTitle || s.lessonId
      const prev = map.get(key) || { title: displayTitle, total: 0, sessions: 0 }
      prev.total += Math.max(0, Math.round((s.endedAt - s.startedAt) / 1000))
      prev.sessions += 1
      map.set(key, prev)
    }
    const arr = Array.from(map.entries()).map(([lessonId, v]) => ({ lessonId, ...v }))
    arr.sort((a, b) => b.total - a.total)
    return arr
  }, [filteredSessions, titlesById])

  const deleteSession = useCallback(async (id: string) => {
    try {
      const key = "learning.sessions"
      const raw = await AsyncStorage.getItem(key)
      const arr: SessionRecord[] = raw ? JSON.parse(raw) : []
      const next = arr.filter((s) => s.id !== id)
      await AsyncStorage.setItem(key, JSON.stringify(next))
      // Update state
      setSessions((cur) => cur.filter((s) => s.id !== id))
    } catch {}
  }, [])

  return (
    <>
  {/* Header handled by Tabs layout; avoid per-screen header overrides */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#fff" }}>

  {/* Summary chips */}
  <View style={{ flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 12, paddingVertical: 12 }}>
        <View style={{ backgroundColor: colorScheme === 'dark' ? '#312e81' : "#eef2ff", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, minWidth: 96, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: colorScheme === 'dark' ? '#6366f1' : "#6366f1" }}>{t("progress.today")}</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colorScheme === 'dark' ? '#fff' : "#111827" }}>{secToHMM(summary.today)}</Text>
        </View>
        <View style={{ backgroundColor: colorScheme === 'dark' ? '#0e7490' : "#ecfeff", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, minWidth: 96, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: colorScheme === 'dark' ? '#06b6d4' : "#06b6d4" }}>{t("progress.thisWeek")}</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colorScheme === 'dark' ? '#fff' : "#111827" }}>{secToHMM(summary.week)}</Text>
        </View>
        <View style={{ backgroundColor: colorScheme === 'dark' ? '#23232a' : "#f5f5f5", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, minWidth: 96, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280" }}>{t("progress.allTime")}</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colorScheme === 'dark' ? '#fff' : "#111827" }}>{secToHMM(summary.all)}</Text>
        </View>
      </View>

  {/* Filters */}
  <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {["7d", "30d", "all"].map((tf) => (
            <Pressable
              key={tf}
              onPress={() => setTimeframe(tf as any)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: timeframe === tf ? (colorScheme === 'dark' ? '#18181b' : '#111827') : (colorScheme === 'dark' ? '#23232a' : '#f3f4f6'),
              }}
            >
              <Text style={{ color: timeframe === tf ? '#fff' : (colorScheme === 'dark' ? '#d1d5db' : '#374151'), fontWeight: "600" }}>
                {tf === "7d" ? t("progress.last7days") : tf === "30d" ? t("progress.last30days") : t("progress.alltime")}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
          <Pressable
            onPress={() => setLessonFilter("all")}
            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: lessonFilter === "all" ? (colorScheme === 'dark' ? '#18181b' : '#111827') : (colorScheme === 'dark' ? '#23232a' : '#f3f4f6') }}
          >
            <Text style={{ color: lessonFilter === "all" ? '#fff' : (colorScheme === 'dark' ? '#d1d5db' : '#374151'), fontWeight: "600" }}>{t("progress.allLessons")}</Text>
          </Pressable>
          {uniqueLessons.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => setLessonFilter(l.id)}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: lessonFilter === l.id ? (colorScheme === 'dark' ? '#18181b' : '#111827') : (colorScheme === 'dark' ? '#23232a' : '#f3f4f6') }}
            >
              <Text style={{ color: lessonFilter === l.id ? '#fff' : (colorScheme === 'dark' ? '#d1d5db' : '#374151'), fontWeight: "600" }}>{l.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

  {/* Weekly bar chart (last 7 days, respects lesson filter) */}
  <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", fontWeight: "700", marginBottom: 8 }}>{t("progress.weekly")}</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 8 }}>
          {weekly.days.map((d, idx) => {
            const h = Math.round((d.total / weekly.max) * 100)
            return (
              <View key={idx} style={{ alignItems: "center", justifyContent: "flex-end", flex: 1 }}>
                <View style={{ width: 20, height: `${h}%`, backgroundColor: colorScheme === 'dark' ? '#6366f1' : '#6366f1', borderRadius: 6 }} />
                <Text style={{ marginTop: 6, fontSize: 12, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280" }}>{d.label}</Text>
              </View>
            )
          })}
        </View>
      </View>

  {/* Per-lesson rollups */}
  <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", fontWeight: "700", marginBottom: 8 }}>{t("progress.topLessons")}</Text>
        {perLessonRollups.length === 0 ? (
          <Text style={{ color: colorScheme === 'dark' ? '#9ca3af' : "#9ca3af" }}>{t("progress.noData")}</Text>
        ) : (
          perLessonRollups.slice(0, 6).map((r) => (
            <View key={r.lessonId} style={{ paddingVertical: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: colorScheme === 'dark' ? '#fff' : "#111827" }} numberOfLines={1}>{r.title}</Text>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colorScheme === 'dark' ? '#fff' : "#111827", marginLeft: 12 }}>{secToHMM(r.total)}</Text>
              </View>
              <Text style={{ color: colorScheme === 'dark' ? '#d1d5db' : "#9ca3af", marginTop: 2 }}>{t("progress.sessions", { count: r.sessions })}</Text>
            </View>
          ))
        )}
      </View>

  {/* Recents list */}
  <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={() => (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Text style={{ color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", textAlign: "center" }}>
              {t("progress.noSessions")}
            </Text>
          </View>
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", fontWeight: "700" }}>
              {title === "Today" ? t("progress.sectionToday") : title === "This Week" ? t("progress.sectionWeek") : t("progress.sectionEarlier")}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const actualSec = Math.max(0, Math.round((item.endedAt - item.startedAt) / 1000))
          const date = new Date(item.startedAt)
          const dateStr = date.toLocaleString()
          return (
            <Swipeable
              renderRightActions={() => (
                <View style={{ justifyContent: "center", alignItems: "center" }}>
                  <Pressable
                    onPress={() => deleteSession(item.id)}
                    style={{ backgroundColor: colorScheme === 'dark' ? '#ef4444' : "#ef4444", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, marginRight: 12 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: "700" }}>{t("progress.delete")}</Text>
                  </Pressable>
                </View>
              )}
            >
              <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colorScheme === 'dark' ? '#23232a' : "#f1f5f9", backgroundColor: colorScheme === 'dark' ? '#18181b' : "#fff" }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: item.finished === false ? (colorScheme === 'dark' ? '#f59e42' : '#f59e42') : (colorScheme === 'dark' ? '#fff' : "#111827") }} numberOfLines={1}>
                    {titlesById[item.lessonId] || item.lessonTitle || item.lessonId}
                    {item.finished === false ? ` (${t('progress.unfinished')})` : ""}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: item.finished === false ? (colorScheme === 'dark' ? '#f59e42' : '#f59e42') : (colorScheme === 'dark' ? '#fff' : "#111827"), marginLeft: 12 }}>{t("progress.actual")} {secToMMSS(actualSec)}</Text>
                </View>
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <Text style={{ flex: 1, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280" }}>{dateStr}</Text>
                  <Text style={{ color: colorScheme === 'dark' ? '#9ca3af' : "#9ca3af" }}>
                    {item.finished === false ? `${t('progress.planned')} ${secToMMSS(item.plannedSeconds)}` : `${t('progress.planned')} ${secToMMSS(item.plannedSeconds)}`}
                    • {item.speed.toFixed(1)}x
                  </Text>
                </View>
              </View>
            </Swipeable>
          )
        }}
      />
        </SafeAreaView>
      </GestureHandlerRootView>
    </>
  )
}
