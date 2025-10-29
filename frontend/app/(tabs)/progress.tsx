import React, { useCallback, useMemo, useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { SectionList, View, Text } from "react-native"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect } from "@react-navigation/native"

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

  const sections = useMemo(() => {
    const now = new Date()
    const today: SessionRecord[] = []
    const week: SessionRecord[] = []
    const earlier: SessionRecord[] = []

    for (const s of sessions) {
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
  }, [sessions])

  return (
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
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, fontSize: 16, fontWeight: "700", color: "#111827" }} numberOfLines={1}>{item.lessonTitle || item.lessonId}</Text>
                <Text style={{ fontSize: 14, fontWeight: "800", color: "#111827", marginLeft: 12 }}>{secToMMSS(actualSec)}</Text>
              </View>
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                <Text style={{ flex: 1, color: "#6b7280" }}>{dateStr}</Text>
                <Text style={{ color: "#9ca3af" }}>planned {secToMMSS(item.plannedSeconds)} • {item.speed.toFixed(2)}x</Text>
              </View>
            </View>
          )
        }}
      />
    </SafeAreaView>
  )
}
