import React, { useCallback, useMemo, useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { SectionList, View, Text, Pressable, ScrollView } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect } from "@react-navigation/native"
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler"

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
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "all">("7d")
  const [lessonFilter, setLessonFilter] = useState<string | "all">("all")

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
      if (!map.has(s.lessonId)) map.set(s.lessonId, s.lessonTitle || s.lessonId)
    })
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }))
  }, [sessions])

  const filteredSessions = useMemo(() => {
    let arr = sessions
    if (timeframe === "7d") arr = arr.filter((s) => withinLastNDays(s.startedAt, 7))
    else if (timeframe === "30d") arr = arr.filter((s) => withinLastNDays(s.startedAt, 30))
    if (lessonFilter !== "all") arr = arr.filter((s) => s.lessonId === lessonFilter)
    return arr
  }, [sessions, timeframe, lessonFilter])

  // Weekly chart data (last 7 days). If lessonFilter applied, respects it.
  const weekly = useMemo(() => {
    const days: { label: string; total: number }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      const label = d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)
      const total = filteredSessions
        .filter((s) => isSameDay(new Date(s.startedAt), d))
        .reduce((acc, s) => acc + Math.max(0, Math.round((s.endedAt - s.startedAt) / 1000)), 0)
      days.push({ label, total })
    }
    const max = Math.max(1, ...days.map((d) => d.total))
    return { days, max }
  }, [filteredSessions])

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
      const prev = map.get(key) || { title: s.lessonTitle || s.lessonId, total: 0, sessions: 0 }
      prev.total += Math.max(0, Math.round((s.endedAt - s.startedAt) / 1000))
      prev.sessions += 1
      map.set(key, prev)
    }
    const arr = Array.from(map.entries()).map(([lessonId, v]) => ({ lessonId, ...v }))
    arr.sort((a, b) => b.total - a.total)
    return arr
  }, [filteredSessions])

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#eee" }}>
          <Text style={{ fontSize: 20, fontWeight: "800", textAlign: "center" }}>Progress</Text>
        </View>

      {/* Summary chips */}
      <View style={{ flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 12, paddingVertical: 12 }}>
        <View style={{ backgroundColor: "#eef2ff", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, minWidth: 96, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: "#6366f1" }}>Today</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>{secToHMM(summary.today)}</Text>
        </View>
        <View style={{ backgroundColor: "#ecfeff", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, minWidth: 96, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: "#06b6d4" }}>This Week</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>{secToHMM(summary.week)}</Text>
        </View>
        <View style={{ backgroundColor: "#f5f5f5", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, minWidth: 96, alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: "#6b7280" }}>All Time</Text>
          <Text style={{ fontSize: 18, fontWeight: "800", color: "#111827" }}>{secToHMM(summary.all)}</Text>
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
                backgroundColor: timeframe === tf ? "#111827" : "#f3f4f6",
              }}
            >
              <Text style={{ color: timeframe === tf ? "#fff" : "#374151", fontWeight: "600" }}>
                {tf === "7d" ? "Last 7 days" : tf === "30d" ? "Last 30 days" : "All time"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
          <Pressable
            onPress={() => setLessonFilter("all")}
            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: lessonFilter === "all" ? "#111827" : "#f3f4f6" }}
          >
            <Text style={{ color: lessonFilter === "all" ? "#fff" : "#374151", fontWeight: "600" }}>All lessons</Text>
          </Pressable>
          {uniqueLessons.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => setLessonFilter(l.id)}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: lessonFilter === l.id ? "#111827" : "#f3f4f6" }}
            >
              <Text style={{ color: lessonFilter === l.id ? "#fff" : "#374151", fontWeight: "600" }}>{l.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Weekly bar chart (last 7 days, respects lesson filter) */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Text style={{ fontSize: 14, color: "#6b7280", fontWeight: "700", marginBottom: 8 }}>Weekly</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 8 }}>
          {weekly.days.map((d, idx) => {
            const h = Math.round((d.total / weekly.max) * 100)
            return (
              <View key={idx} style={{ alignItems: "center", justifyContent: "flex-end", flex: 1 }}>
                <View style={{ width: 20, height: `${h}%`, backgroundColor: "#6366f1", borderRadius: 6 }} />
                <Text style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>{d.label}</Text>
              </View>
            )
          })}
        </View>
      </View>

      {/* Per-lesson rollups */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ fontSize: 14, color: "#6b7280", fontWeight: "700", marginBottom: 8 }}>Top lessons</Text>
        {perLessonRollups.length === 0 ? (
          <Text style={{ color: "#9ca3af" }}>No data</Text>
        ) : (
          perLessonRollups.slice(0, 6).map((r) => (
            <View key={r.lessonId} style={{ paddingVertical: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: "#111827" }} numberOfLines={1}>{r.title}</Text>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827", marginLeft: 12 }}>{secToHMM(r.total)}</Text>
              </View>
              <Text style={{ color: "#9ca3af", marginTop: 2 }}>{r.sessions} session{r.sessions === 1 ? "" : "s"}</Text>
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
            <Text style={{ color: "#6b7280", textAlign: "center" }}>
              No sessions yet. Start a timed session from any lesson to see your learning history here.
            </Text>
          </View>
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={{ fontSize: 14, color: "#6b7280", fontWeight: "700" }}>{title}</Text>
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
                    style={{ backgroundColor: "#ef4444", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, marginRight: 12 }}
                  >
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Delete</Text>
                  </Pressable>
                </View>
              )}
            >
              <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fff" }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: "#111827" }} numberOfLines={1}>{item.lessonTitle || item.lessonId}</Text>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827", marginLeft: 12 }}>{secToMMSS(actualSec)}</Text>
                </View>
                <View style={{ flexDirection: "row", marginTop: 4 }}>
                  <Text style={{ flex: 1, color: "#6b7280" }}>{dateStr}</Text>
                  <Text style={{ color: "#9ca3af" }}>planned {secToMMSS(item.plannedSeconds)} • {item.speed.toFixed(2)}x</Text>
                </View>
              </View>
            </Swipeable>
          )
        }}
      />
    </SafeAreaView>
    </GestureHandlerRootView>
  )
}
