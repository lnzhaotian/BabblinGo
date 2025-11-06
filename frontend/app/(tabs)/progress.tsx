import React, { useCallback, useEffect, useMemo, useState } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { SectionList, View, Text, Pressable, ScrollView } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler"
import { useTranslation } from "react-i18next"
import { CourseDoc, fetchCourseById, fetchLessonById, resolveLocalizedField } from "@/lib/payload"
import AsyncStorage from "@react-native-async-storage/async-storage"
import type { SessionRecord } from "@/lib/learning-types"
import { LEARNING_SESSIONS_STORAGE_KEY } from "@/lib/learning-types"
import { scheduleLearningRecordSync } from "../../lib/learning-sync"
import { useThemeMode } from "../theme-context"

type LessonMeta = {
  title: string
  courseId?: string
  courseSlug?: string
  courseTitle?: string
  levelKey?: string | null
  levelLabel?: string
}

type ChartPoint = {
  id: string
  label: string
  total: number
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

const BAR_MAX_HEIGHT = 120

const getSessionSeconds = (session: SessionRecord): number =>
  session.durationSeconds ?? Math.max(0, Math.round((session.endedAt - session.startedAt) / 1000))

const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const withinLastNDays = (ms: number, days: number) => {
  const now = Date.now()
  const start = now - days * 24 * 60 * 60 * 1000
  return ms >= start
}
const PAGE_SIZE = 25

export default function ProgressScreen() {
  const { t, i18n } = useTranslation()
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "all">("30d")
  const [courseFilter, setCourseFilter] = useState<string | "all">("all")
  const [lessonMetaById, setLessonMetaById] = useState<Record<string, LessonMeta>>({})
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE)
  const [loadingMore, setLoadingMore] = useState(false)
  const { colorScheme } = useThemeMode();

  const loadSessions = useCallback(async () => {
    try {
  const raw = await AsyncStorage.getItem(LEARNING_SESSIONS_STORAGE_KEY)
      const arr: SessionRecord[] = raw ? JSON.parse(raw) : []
      // newest first
      arr.sort((a, b) => b.startedAt - a.startedAt)
      setSessions(arr)
    } catch {}
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadSessions()
      scheduleLearningRecordSync()
        .then(() => {
          loadSessions()
        })
        .catch(() => {
          // no-op; errors are logged in the scheduler
        })
      return () => {}
    }, [loadSessions])
  )

  // Fetch localized lesson titles for current language (only for visible + next page)
  useEffect(() => {
    const loadMeta = async () => {
      try {
        const limitForMeta = Math.min(sessions.length, visibleCount + PAGE_SIZE)
        const ids = Array.from(new Set(sessions.slice(0, limitForMeta).map((s) => s.lessonId)))
        if (ids.length === 0) {
          setLessonMetaById({})
          return
        }

        const courseCache = new Map<string, CourseDoc>()

        const entries = await Promise.all(
          ids.map(async (id) => {
            try {
              const doc = await fetchLessonById(id, i18n.language)

              let courseDoc: CourseDoc | undefined
              let courseId: string | undefined
              let courseSlug: string | undefined

              if (doc.course && typeof doc.course === "object") {
                courseDoc = doc.course as CourseDoc
                courseId = courseDoc.id
                courseSlug = courseDoc.slug
              } else if (typeof doc.course === "string") {
                courseId = doc.course
                courseDoc = courseCache.get(courseId)
                if (!courseDoc) {
                  try {
                    courseDoc = await fetchCourseById(courseId, i18n.language)
                    courseCache.set(courseId, courseDoc)
                  } catch {
                    courseDoc = undefined
                  }
                }
                courseSlug = courseDoc?.slug
              }

              const resolvedCourseTitle = courseDoc
                ? resolveLocalizedField(courseDoc.title, i18n.language) ?? courseDoc.slug
                : undefined

              const levelKey = doc.level ?? null
              let levelLabel: string | undefined
              if (levelKey && courseDoc?.levels) {
                const matched = courseDoc.levels.find((lvl) => lvl && lvl.key === levelKey)
                if (matched) {
                  levelLabel =
                    resolveLocalizedField(matched.label ?? matched.key, i18n.language) ?? matched.key ?? undefined
                }
              }

              return [
                id,
                {
                  title: doc.title,
                  courseId,
                  courseSlug,
                  courseTitle: resolvedCourseTitle,
                  levelKey,
                  levelLabel,
                } satisfies LessonMeta,
              ] as const
            } catch {
              const saved = sessions.find((s) => s.lessonId === id)?.lessonTitle || id
              return [
                id,
                {
                  title: saved,
                } satisfies LessonMeta,
              ] as const
            }
          })
        )

        const map: Record<string, LessonMeta> = {}
        for (const [id, meta] of entries) {
          map[id] = meta
        }
        setLessonMetaById(map)
      } catch {
        // ignore failures; fallbacks will handle
      }
    }

    loadMeta()
  }, [sessions, visibleCount, i18n.language])

  const fallbackCourseName = t("home.untitledCourse")

  const summary = useMemo(() => {
    const now = new Date()
    let today = 0
    let week = 0
    let all = 0
    for (const s of sessions) {
      const dur = getSessionSeconds(s)
      all += dur
      const started = new Date(s.startedAt)
      if (isSameDay(started, now)) today += dur
      if (withinLastNDays(s.startedAt, 7)) week += dur
    }
    return { today, week, all }
  }, [sessions])

  const courseOptions = useMemo(() => {
    const map = new Map<string, { title: string; count: number }>()

    sessions.forEach((s) => {
      const meta = lessonMetaById[s.lessonId]
      if (!meta?.courseId) {
        return
      }

      const displayTitle = meta.courseTitle && meta.courseTitle.trim().length > 0
        ? meta.courseTitle
        : fallbackCourseName

      const existing = map.get(meta.courseId)
      if (existing) {
        existing.count += 1
        if (meta.courseTitle && meta.courseTitle.trim().length > 0) {
          existing.title = meta.courseTitle
        }
      } else {
        map.set(meta.courseId, { title: displayTitle, count: 1 })
      }
    })

    return Array.from(map.entries())
      .map(([courseId, info]) => ({ courseId, title: info.title, count: info.count }))
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }))
  }, [sessions, lessonMetaById, fallbackCourseName])

  useEffect(() => {
    if (courseFilter === "all") {
      return
    }

    const hasCourse = courseOptions.some((option) => option.courseId === courseFilter)
    if (!hasCourse) {
      setCourseFilter("all")
    }
  }, [courseFilter, courseOptions])

  const filteredSessions = useMemo(() => {
    let arr = sessions
    if (timeframe === "7d") arr = arr.filter((s) => withinLastNDays(s.startedAt, 7))
    else if (timeframe === "30d") arr = arr.filter((s) => withinLastNDays(s.startedAt, 30))
    if (courseFilter !== "all") {
      arr = arr.filter((s) => {
        const meta = lessonMetaById[s.lessonId]
        return meta?.courseId === courseFilter
      })
    }
    return arr
  }, [sessions, timeframe, courseFilter, lessonMetaById])

  // Reset paging whenever filters change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [timeframe, courseFilter])

  const visibleFiltered = useMemo(() => filteredSessions.slice(0, visibleCount), [filteredSessions, visibleCount])

  // Time-series chart data driven by current timeframe filter.
  const chart = useMemo(() => {
    const totalsByDay = new Map<number, number>()
    filteredSessions.forEach((session) => {
      const startDay = new Date(session.startedAt)
      startDay.setHours(0, 0, 0, 0)
      const key = startDay.getTime()
      const duration = getSessionSeconds(session)
      totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + duration)
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const formatWeekday = new Intl.DateTimeFormat(i18n.language, { weekday: "short" })
    const formatMonthDay = new Intl.DateTimeFormat(i18n.language, { month: "short", day: "numeric" })
    const formatMonth = new Intl.DateTimeFormat(i18n.language, { month: "short", year: "2-digit" })

    const getTotalBetween = (startTime: number, endTime: number) => {
      let sum = 0
      totalsByDay.forEach((value, day) => {
        if (day >= startTime && day <= endTime) {
          sum += value
        }
      })
      return sum
    }

    const points: ChartPoint[] = []

    if (timeframe === "7d") {
      for (let offset = 6; offset >= 0; offset -= 1) {
        const day = new Date(today)
        day.setDate(today.getDate() - offset)
        const key = day.getTime()
        const total = totalsByDay.get(key) ?? 0
        points.push({ id: key.toString(), label: formatWeekday.format(day), total })
      }
    } else if (timeframe === "30d") {
      const start = new Date(today)
      start.setDate(today.getDate() - 29)
      const cursor = new Date(start)
      while (cursor <= today) {
        const bucketStart = new Date(cursor)
        const bucketEnd = new Date(cursor)
        bucketEnd.setDate(bucketEnd.getDate() + 6)
        if (bucketEnd > today) {
          bucketEnd.setTime(today.getTime())
        }

        const startKey = bucketStart.getTime()
        const endKey = bucketEnd.getTime()
        const total = getTotalBetween(startKey, endKey)
        const startLabel = formatMonthDay.format(bucketStart)
        const endLabel = formatMonthDay.format(bucketEnd)
        const label = startLabel === endLabel ? startLabel : `${startLabel}–${endLabel}`
        points.push({ id: `${startKey}-${endKey}`, label, total })

        cursor.setDate(cursor.getDate() + 7)
      }
    } else {
      const dayKeys = Array.from(totalsByDay.keys()).sort((a, b) => a - b)
      if (dayKeys.length === 0) {
        return { points: [], max: 1, scrollable: false }
      }

      const initialStart = new Date(today)
      initialStart.setMonth(initialStart.getMonth() - 11)
      initialStart.setDate(1)
      initialStart.setHours(0, 0, 0, 0)

      const earliest = new Date(dayKeys[0])
      earliest.setDate(1)
      earliest.setHours(0, 0, 0, 0)

      const start = earliest > initialStart ? earliest : initialStart
      const cursor = new Date(start)
      const limit = 12
      while ((cursor <= today || points.length === 0) && points.length < limit) {
        const bucketStart = new Date(cursor)
        const nextMonth = new Date(bucketStart)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        nextMonth.setHours(0, 0, 0, 0)

        const startMs = bucketStart.getTime()
        const endMs = Math.min(nextMonth.getTime() - 1, today.getTime())
        const total = getTotalBetween(startMs, endMs)
        const label = formatMonth.format(bucketStart)
        points.push({ id: `${bucketStart.getFullYear()}-${bucketStart.getMonth()}`, label, total })

        cursor.setMonth(cursor.getMonth() + 1)
        cursor.setDate(1)
      }
    }

    const maxValue = points.reduce((acc, point) => Math.max(acc, point.total), 0)
    const max = maxValue > 0 ? maxValue : 1
    const scrollable = points.length > 8

    return { points, max, scrollable }
  }, [filteredSessions, timeframe, i18n.language])

  const chartTitle =
    timeframe === "7d"
      ? t("progress.chartTitle7d")
      : timeframe === "30d"
      ? t("progress.chartTitle30d")
      : t("progress.chartTitleAll")

  const chartHasData = chart.points.some((point) => point.total > 0)

  const chartBars = chart.points.map((point) => {
    const normalized = chart.max > 0 ? point.total / chart.max : 0
    const height = Math.max(4, Math.round(normalized * BAR_MAX_HEIGHT))
    return (
      <View key={point.id} style={{ alignItems: "center", justifyContent: "flex-end", width: 48 }}>
        <View
          style={{
            width: 22,
            height,
            borderRadius: 8,
            backgroundColor: colorScheme === 'dark' ? '#6366f1' : '#6366f1',
          }}
        />
        <Text
          style={{ marginTop: 6, fontSize: 12, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", textAlign: "center" }}
          numberOfLines={2}
        >
          {point.label}
        </Text>
      </View>
    )
  })

  const sections = useMemo(() => {
    const now = new Date()
    const today: SessionRecord[] = []
    const week: SessionRecord[] = []
    const earlier: SessionRecord[] = []

    for (const s of visibleFiltered) {
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
  }, [visibleFiltered])

  const hasMore = visibleCount < filteredSessions.length
  const handleEndReached = useCallback(() => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    // Simulate async to allow SectionList to settle before increasing slice
    requestAnimationFrame(() => {
      setVisibleCount((c) => Math.min(c + PAGE_SIZE, filteredSessions.length))
      setLoadingMore(false)
    })
  }, [hasMore, loadingMore, filteredSessions.length])

  const deleteSession = useCallback(async (id: string) => {
    try {
  const key = LEARNING_SESSIONS_STORAGE_KEY
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
            onPress={() => setCourseFilter("all")}
            style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: courseFilter === "all" ? (colorScheme === 'dark' ? '#18181b' : '#111827') : (colorScheme === 'dark' ? '#23232a' : '#f3f4f6') }}
          >
            <Text style={{ color: courseFilter === "all" ? '#fff' : (colorScheme === 'dark' ? '#d1d5db' : '#374151'), fontWeight: "600" }}>{t("progress.allCourses")}</Text>
          </Pressable>
          {courseOptions.map((option) => (
            <Pressable
              key={option.courseId}
              onPress={() => setCourseFilter(option.courseId)}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, backgroundColor: courseFilter === option.courseId ? (colorScheme === 'dark' ? '#18181b' : '#111827') : (colorScheme === 'dark' ? '#23232a' : '#f3f4f6') }}
            >
              <Text style={{ color: courseFilter === option.courseId ? '#fff' : (colorScheme === 'dark' ? '#d1d5db' : '#374151'), fontWeight: "600" }}>{option.title}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

  {/* Activity chart */}
  <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", fontWeight: "700", marginBottom: 8 }}>{chartTitle}</Text>
        {chart.points.length === 0 || !chartHasData ? (
          <Text style={{ color: colorScheme === 'dark' ? '#9ca3af' : "#9ca3af", marginTop: 12 }}>{t("progress.chartEmpty")}</Text>
        ) : chart.scrollable ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4, paddingRight: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-end", minHeight: BAR_MAX_HEIGHT, gap: 12 }}>{chartBars}</View>
          </ScrollView>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "flex-end", minHeight: BAR_MAX_HEIGHT, gap: 12, paddingVertical: 4 }}>{chartBars}</View>
        )}
      </View>

  {/* Recents list */}
  <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        removeClippedSubviews
        windowSize={8}
        initialNumToRender={12}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.6}
        ListFooterComponent={() => (
          hasMore ? (
            <View style={{ paddingVertical: 16, alignItems: "center" }}>
              <Text style={{ color: colorScheme === 'dark' ? '#9ca3af' : '#6b7280' }}>Loading more…</Text>
            </View>
          ) : (
            filteredSessions.length > 0 ? (
              <View style={{ paddingVertical: 16, alignItems: "center" }}>
                <Text style={{ color: colorScheme === 'dark' ? '#9ca3af' : '#6b7280' }}>End of history</Text>
              </View>
            ) : null
          )
        )}
        ListEmptyComponent={() => (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Text style={{ color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", textAlign: "center" }}>
              {t("progress.noSessions")}
            </Text>
          </View>
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 4,
              backgroundColor: colorScheme === 'dark' ? "rgba(24, 24, 27, 0.92)" : "rgba(255, 255, 255, 0.92)",
            }}
          >
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", fontWeight: "700" }}>
              {title === "Today" ? t("progress.sectionToday") : title === "This Week" ? t("progress.sectionWeek") : t("progress.sectionEarlier")}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const actualSec = getSessionSeconds(item)
          const date = new Date(item.startedAt)
          const dateStr = date.toLocaleString()
          const meta = lessonMetaById[item.lessonId]
          const lessonTitle = meta?.title || item.lessonTitle || item.lessonId
          const courseTitle = meta?.courseTitle && meta.courseTitle.trim().length > 0
            ? meta.courseTitle
            : meta?.courseId
            ? fallbackCourseName
            : undefined
          const detailLine = [courseTitle, meta?.levelLabel].filter(Boolean).join(" • ")
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
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colorScheme === 'dark' ? '#fff' : "#111827" }} numberOfLines={1}>
                      {lessonTitle}
                    </Text>
                    {detailLine ? (
                      <Text style={{ marginTop: 2, color: colorScheme === 'dark' ? '#a1a1aa' : "#6b7280" }} numberOfLines={1}>
                        {detailLine}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colorScheme === 'dark' ? '#e5e7eb' : "#4b5563", marginLeft: 12 }}>{secToMMSS(actualSec)}</Text>
                </View>
                <Text style={{ marginTop: 6, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280" }}>{dateStr}</Text>
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
