import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  Pressable,
  Switch,
  ActivityIndicator,
  Modal,
  FlatList,
  KeyboardAvoidingView,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker"
import { useThemeMode } from "../theme-context"
import { saveLearningSession } from "@/lib/session-manager"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"
import { MaterialIcons } from "@expo/vector-icons"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { getAuthToken } from "@/lib/auth-session"
import { config } from "@/lib/config"
import type { CourseDoc, LessonDoc } from "@/lib/payload"
import { resolveLocalizedField } from "@/lib/payload"

const MIN_DURATION_MS = 60 * 1000
const MAX_DURATION_MS = 8 * 60 * 60 * 1000
const RECENT_LESSONS_KEY = "manualEntry.recentLessons"
const MAX_RECENT_LESSONS = 6

type PickerTarget = "start" | "end"

type LinkedLesson = {
  id: string
  title: string
  courseTitle?: string | null
  courseId?: string | null
  defaultTrackingEnabled?: boolean | null
}

const readRecentLessons = async (): Promise<LinkedLesson[]> => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_LESSONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item: unknown): item is LinkedLesson => {
        return (
          typeof item === "object" &&
          item !== null &&
          typeof (item as { id?: unknown }).id === "string" &&
          typeof (item as { title?: unknown }).title === "string"
        )
      })
      .slice(0, MAX_RECENT_LESSONS)
  } catch (error) {
    console.warn("[manual-entry] failed to read recent lessons", error)
    return []
  }
}

const persistRecentLessons = async (lessons: LinkedLesson[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(RECENT_LESSONS_KEY, JSON.stringify(lessons.slice(0, MAX_RECENT_LESSONS)))
  } catch (error) {
    console.warn("[manual-entry] failed to persist recent lessons", error)
  }
}

const formatDateTime = (date: Date, locale: string) => {
  try {
    return date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return date.toISOString()
  }
}

const slugify = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

export default function ManualEntryScreen() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { colorScheme } = useThemeMode()

  const defaultEnd = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => new Date(Date.now() - 30 * 60 * 1000), [])

  const [lessonTitle, setLessonTitle] = useState("")
  const [lessonId, setLessonId] = useState("")
  const [notes, setNotes] = useState("")
  const [startAt, setStartAt] = useState<Date>(defaultStart)
  const [endAt, setEndAt] = useState<Date>(defaultEnd)
  const [finished, setFinished] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activePicker, setActivePicker] = useState<PickerTarget | null>(null)
  const [linkedLesson, setLinkedLesson] = useState<LinkedLesson | null>(null)
  const [recentLessons, setRecentLessons] = useState<LinkedLesson[]>([])
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<LinkedLesson[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchAbortController = useRef<AbortController | null>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const background = colorScheme === "dark" ? "#18181b" : "#f9fafb"
  const contentBackground = colorScheme === "dark" ? "#23232a" : "#fff"
  const textColor = colorScheme === "dark" ? "#f4f4f5" : "#111827"
  const subTextColor = colorScheme === "dark" ? "#a1a1aa" : "#6b7280"
  const inputBackground = colorScheme === "dark" ? "#2f2f36" : "#f3f4f6"
  const borderColor = colorScheme === "dark" ? "#3f3f46" : "#e5e7eb"
  const accent = "#6366f1"
  const trimmedSearchQuery = searchQuery.trim()
  const resultsToShow = trimmedSearchQuery.length > 0 ? searchResults : recentLessons

  const closeLessonSearch = useCallback(() => {
    const debounce = searchDebounceRef.current
    if (debounce) {
      clearTimeout(debounce)
      searchDebounceRef.current = null
    }
    const controller = searchAbortController.current
    if (controller) {
      controller.abort()
      searchAbortController.current = null
    }
    setSearchVisible(false)
    setSearchQuery("")
    setSearchResults([])
    setSearchError(null)
    setSearchLoading(false)
  }, [])

  const openLessonSearch = useCallback(() => {
    const debounce = searchDebounceRef.current
    if (debounce) {
      clearTimeout(debounce)
      searchDebounceRef.current = null
    }
    const controller = searchAbortController.current
    if (controller) {
      controller.abort()
      searchAbortController.current = null
    }
    setSearchVisible(true)
    setSearchQuery("")
    setSearchResults([])
    setSearchError(null)
    setSearchLoading(false)
  }, [])

  useEffect(() => {
    return () => {
      closeLessonSearch()
    }
  }, [closeLessonSearch])

  const applyLinkedLesson = useCallback(
    (lesson: LinkedLesson) => {
      setLinkedLesson(lesson)
      setLessonId(lesson.id)
      if (lessonTitle.trim().length === 0) {
        setLessonTitle(lesson.title)
      }
      setRecentLessons((prev) => {
        const filtered = prev.filter((item) => item.id !== lesson.id)
        const updated = [lesson, ...filtered].slice(0, MAX_RECENT_LESSONS)
        persistRecentLessons(updated).catch((error) => {
          console.warn("[manual-entry] failed to update recent lessons", error)
        })
        return updated
      })
    },
    [lessonTitle]
  )

  const clearLinkedLesson = useCallback(() => {
    setLinkedLesson(null)
    setLessonId("")
  }, [])

  const executeSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim()
      const currentController = searchAbortController.current
      if (currentController) {
        currentController.abort()
      }

      if (trimmed.length === 0) {
        searchAbortController.current = null
        setSearchLoading(false)
        setSearchError(null)
        setSearchResults([])
        return
      }

      const controller = new AbortController()
      searchAbortController.current = controller
      setSearchLoading(true)
      setSearchError(null)

      const run = async () => {
        try {
          const token = await getAuthToken()
          const localeKey = (i18n.language || "en").split("-")[0]
          const likeValue = `%${trimmed.replace(/%/g, "\\%")}%`
          const localeParam = i18n.language || localeKey

          const params = new URLSearchParams({
            limit: "20",
            depth: "1",
            sort: "title",
            locale: localeParam,
          })

          params.set(`where[title.${localeKey}][like]`, likeValue)

          const response = await fetch(`${config.apiUrl}/api/lessons?${params.toString()}`, {
            headers: {
              Accept: "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          })

          if (controller.signal.aborted) {
            return
          }

          if (response.status === 401 || response.status === 403) {
            setSearchResults([])
            setSearchError(t("manualEntry.linkLessonUnauthorized"))
            return
          }

          if (!response.ok) {
            const text = await response.text().catch(() => "")
            console.warn("[manual-entry] lesson search failed", response.status, text)
            setSearchResults([])
            setSearchError(t("manualEntry.linkLessonError"))
            return
          }

          const data = await response.json()
          const docsArray = Array.isArray(data?.docs) ? (data.docs as LessonDoc[]) : []

          const mapLesson = (doc: LessonDoc): LinkedLesson | null => {
            const resolvedTitle = resolveLocalizedField(doc.title, i18n.language) ?? doc.slug ?? null
            if (!resolvedTitle) {
              return null
            }

            let courseTitle: string | null = null
            let courseId: string | null = null
            let defaultTrackingEnabled: boolean | null = null

            if (doc.course && typeof doc.course === "object") {
              const courseDoc = doc.course as CourseDoc
              courseTitle = resolveLocalizedField(courseDoc.title, i18n.language) ?? courseDoc.slug ?? null
              courseId = courseDoc.id
              defaultTrackingEnabled = courseDoc.defaultTrackingEnabled ?? null
            } else if (typeof doc.course === "string") {
              courseId = doc.course
            }

            return {
              id: doc.id,
              title: resolvedTitle,
              courseTitle,
              courseId,
              defaultTrackingEnabled,
            }
          }

          const queryLower = trimmed.toLowerCase()

          const mapDocs = (docs: LessonDoc[]) =>
            docs
              .map(mapLesson)
              .filter((lesson): lesson is LinkedLesson => Boolean(lesson))

          let mapped = mapDocs(docsArray)

          if (mapped.length === 0 && trimmed.length > 0) {
            const fallbackParams = new URLSearchParams({
              limit: "100",
              depth: "1",
              sort: "title",
              locale: localeParam,
            })

            const fallbackResponse = await fetch(`${config.apiUrl}/api/lessons?${fallbackParams.toString()}`, {
              headers: {
                Accept: "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              signal: controller.signal,
            })

            if (fallbackResponse.ok && !controller.signal.aborted) {
              const fallbackData = await fallbackResponse.json().catch(() => null)
              const fallbackDocs = Array.isArray(fallbackData?.docs) ? (fallbackData.docs as LessonDoc[]) : []
              const filtered = fallbackDocs.filter((doc) => {
                const titleValue = resolveLocalizedField(doc.title, i18n.language) ?? doc.slug ?? ""
                const courseValue =
                  doc.course && typeof doc.course === "object"
                    ? resolveLocalizedField((doc.course as CourseDoc).title, i18n.language) ?? (doc.course as CourseDoc).slug ?? ""
                    : ""
                const titleMatch = titleValue.toLowerCase().includes(queryLower)
                const courseMatch = courseValue.toLowerCase().includes(queryLower)
                return titleMatch || courseMatch
              })
              mapped = mapDocs(filtered)
            }
          }

          setSearchResults(mapped)
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            return
          }
          console.warn("[manual-entry] lesson search error", error)
          setSearchResults([])
          setSearchError(t("manualEntry.linkLessonError"))
        } finally {
          if (!controller.signal.aborted) {
            setSearchLoading(false)
          }
        }
      }

      run()
    },
    [i18n.language, t]
  )

  useEffect(() => {
    if (!searchVisible) {
      return
    }
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    searchDebounceRef.current = setTimeout(() => {
      executeSearch(searchQuery)
    }, 300)

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = null
      }
    }
  }, [searchQuery, searchVisible, executeSearch])

  const handleSelectLessonFromSearch = useCallback(
    (lesson: LinkedLesson) => {
      applyLinkedLesson(lesson)
      closeLessonSearch()
    },
    [applyLinkedLesson, closeLessonSearch]
  )

  useEffect(() => {
    let active = true
    ;(async () => {
      const stored = await readRecentLessons()
      if (active) {
        setRecentLessons(stored)
      }
    })()
    return () => {
      active = false
    }
  }, [])


  const ensureChronology = (nextStart: Date, nextEnd: Date) => {
    if (nextEnd.getTime() <= nextStart.getTime()) {
      const adjusted = new Date(nextStart.getTime() + 30 * 60 * 1000)
      return adjusted
    }
    return nextEnd
  }

  const handleChange = (type: PickerTarget, event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === "dismissed") {
      setActivePicker(null)
      return
    }
    if (selectedDate) {
      if (type === "start") {
        const nextStart = selectedDate
        const adjustedEnd = ensureChronology(nextStart, endAt)
        setStartAt(nextStart)
        setEndAt(adjustedEnd)
      } else {
        const minEnd = new Date(startAt.getTime() + MIN_DURATION_MS)
        const nextEnd = selectedDate.getTime() <= minEnd.getTime() ? minEnd : selectedDate
        setEndAt(nextEnd)
      }
    }
    if (Platform.OS === "android") {
      setActivePicker(null)
    }
  }

  const openPicker = (type: PickerTarget) => {
    if (Platform.OS === "android") {
      const current = type === "start" ? startAt : endAt
      DateTimePickerAndroid.open({
        mode: "date",
        value: current,
        onChange: (event, date) => {
          if (event.type === "dismissed" || !date) {
            return
          }
          const interim = new Date(date)
          DateTimePickerAndroid.open({
            mode: "time",
            value: interim,
            onChange: (timeEvent, timeDate) => {
              if (timeEvent.type === "dismissed" || !timeDate) {
                return
              }
              handleChange(type, timeEvent, timeDate)
            },
            is24Hour: false,
          })
        },
        is24Hour: false,
      })
      return
    }
    setActivePicker(type)
  }

  const validate = () => {
  const isLinked = linkedLesson != null
  const trimmedTitle = lessonTitle.trim()
  const resolvedTitle = isLinked ? linkedLesson!.title.trim() : trimmedTitle

    if (resolvedTitle.length === 0) {
      Alert.alert(t("common.error"), t("manualEntry.error.invalidTitle"))
      return null
    }
    const startMs = startAt.getTime()
    const endMs = endAt.getTime()
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      Alert.alert(t("common.error"), t("manualEntry.error.generic"))
      return null
    }
    if (endMs <= startMs) {
      Alert.alert(t("common.error"), t("manualEntry.error.endBeforeStart"))
      return null
    }
    const durationMs = endMs - startMs
    if (durationMs < MIN_DURATION_MS) {
      Alert.alert(t("common.error"), t("manualEntry.error.invalidDuration"))
      return null
    }
    if (durationMs > MAX_DURATION_MS) {
      Alert.alert(t("common.error"), t("manualEntry.error.invalidDuration"))
      return null
    }
    return {
      title: resolvedTitle,
  lessonId: isLinked ? linkedLesson!.id : lessonId.trim(),
      isLinked,
      startMs,
      endMs,
      durationMs,
    }
  }

  const handleSubmit = async () => {
    const payload = validate()
    if (!payload) return

    const { title, lessonId: providedLessonId, startMs, endMs, durationMs, isLinked } = payload
    const durationSeconds = Math.round(durationMs / 1000)
    const manualLessonId = isLinked
      ? providedLessonId
      : providedLessonId.length > 0
      ? providedLessonId
      : `manual-${slugify(title) || "session"}-${Date.now().toString(36)}`

    // Extract course info if linked
    const courseId = isLinked && linkedLesson?.courseId ? linkedLesson.courseId : undefined
    const defaultTrackingEnabled = isLinked && linkedLesson?.defaultTrackingEnabled != null ? linkedLesson.defaultTrackingEnabled : undefined

    setSaving(true)
    try {
      await saveLearningSession({
        lessonId: manualLessonId,
        lessonTitle: title,
        startedAt: startMs,
        endedAt: endMs,
        plannedSeconds: durationSeconds,
        speed: 1 as PlaybackSpeed,
        finished,
        segments: 1,
        source: "manual",
        notes,
        courseId,
        defaultTrackingEnabled,
      })
      Alert.alert(t("manualEntry.successTitle"), t("manualEntry.successMessage"), [
        {
          text: t("common.done"),
          onPress: () => router.back(),
        },
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : null
      Alert.alert(t("common.error"), message ?? t("manualEntry.error.generic"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: contentBackground, borderWidth: 1, borderColor }}
          accessibilityRole="button"
          accessibilityHint={t("manualEntry.backHint")}
        >
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 24, fontWeight: "700", color: textColor }}>{t("manualEntry.title")}</Text>
          <Text style={{ fontSize: 14, color: subTextColor }}>{t("manualEntry.subtitle")}</Text>
        </View>

        <View style={{ backgroundColor: contentBackground, borderRadius: 16, padding: 16, borderWidth: 1, borderColor }}>
          <View style={{ gap: 12 }}>
            {!linkedLesson ? (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }}>{t("manualEntry.lessonLabel")}</Text>
                <TextInput
                  value={lessonTitle}
                  onChangeText={setLessonTitle}
                  placeholder={t("manualEntry.lessonPlaceholder")}
                  placeholderTextColor={subTextColor}
                  style={{
                    backgroundColor: inputBackground,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderRadius: 12,
                    color: textColor,
                    fontSize: 16,
                  }}
                  autoCapitalize="sentences"
                  autoCorrect
                  returnKeyType="next"
                />
              </View>
            ) : null}

            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }}>{t("manualEntry.linkLessonLabel")}</Text>
              {linkedLesson ? (
                <View
                  style={{
                    backgroundColor: inputBackground,
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor,
                    gap: 6,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "700", color: textColor }}>{linkedLesson.title}</Text>
                  {linkedLesson.courseTitle ? (
                    <Text style={{ fontSize: 13, color: subTextColor }}>{linkedLesson.courseTitle}</Text>
                  ) : null}
                  <Pressable
                    onPress={clearLinkedLesson}
                    style={({ pressed }) => ({
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor,
                      backgroundColor: pressed ? (colorScheme === "dark" ? "#27272a" : "#e5e7eb") : contentBackground,
                    })}
                  >
                    <Text style={{ color: subTextColor, fontWeight: "600" }}>{t("manualEntry.linkLessonClear")}</Text>
                  </Pressable>
                  <Text style={{ fontSize: 12, color: subTextColor }}>{t("manualEntry.linkedLessonAutoTitle")}</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: subTextColor }}>{t("manualEntry.linkLessonNone")}</Text>
              )}

              <Pressable
                onPress={openLessonSearch}
                style={({ pressed }) => ({
                  backgroundColor: colorScheme === "dark" ? "#312e81" : "#eef2ff",
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colorScheme === "dark" ? "#3730a3" : "#c7d2fe",
                  opacity: pressed ? 0.9 : 1,
                })}
              >
                <Text style={{ color: colorScheme === "dark" ? "#c7d2fe" : "#312e81", fontWeight: "700" }}>
                  {t("manualEntry.linkLessonButton")}
                </Text>
              </Pressable>

              <Text style={{ fontSize: 12, color: subTextColor }}>{t("manualEntry.linkLessonHint")}</Text>

              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: subTextColor }}>{t("manualEntry.recentLessons")}</Text>
                {recentLessons.length > 0 ? (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {recentLessons.map((lesson) => {
                      const isActive = linkedLesson?.id === lesson.id
                      return (
                        <Pressable
                          key={lesson.id}
                          onPress={() => applyLinkedLesson(lesson)}
                          style={({ pressed }) => ({
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 999,
                            backgroundColor: isActive ? accent : colorScheme === "dark" ? "#2f2f36" : "#e5e7eb",
                            borderWidth: 1,
                            borderColor: isActive ? accent : colorScheme === "dark" ? "#3f3f46" : "#d1d5db",
                            opacity: pressed ? 0.85 : 1,
                            maxWidth: "100%",
                          })}
                        >
                          <Text style={{ color: isActive ? "#fff" : textColor, fontWeight: "600" }} numberOfLines={1}>
                            {lesson.title}
                          </Text>
                          {lesson.courseTitle ? (
                            <Text style={{ color: isActive ? "#e0e7ff" : subTextColor, fontSize: 11 }} numberOfLines={1}>
                              {lesson.courseTitle}
                            </Text>
                          ) : null}
                        </Pressable>
                      )
                    })}
                  </View>
                ) : (
                  <Text style={{ fontSize: 12, color: subTextColor }}>{t("manualEntry.recentEmpty")}</Text>
                )}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }}>{t("manualEntry.startLabel")}</Text>
              <Pressable
                onPress={() => openPicker("start")}
                style={{
                  backgroundColor: inputBackground,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor,
                }}
              >
                <Text style={{ color: textColor, fontSize: 16 }}>{formatDateTime(startAt, i18n.language)}</Text>
              </Pressable>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }}>{t("manualEntry.endLabel")}</Text>
              <Pressable
                onPress={() => openPicker("end")}
                style={{
                  backgroundColor: inputBackground,
                  paddingHorizontal: 12,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor,
                }}
              >
                <Text style={{ color: textColor, fontSize: 16 }}>{formatDateTime(endAt, i18n.language)}</Text>
              </Pressable>
              <Text style={{ fontSize: 12, color: subTextColor }}>{t("manualEntry.endHint")}</Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", display: "none" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }}>{t("manualEntry.finishedLabel")}</Text>
                <Text style={{ fontSize: 12, color: subTextColor }}>{t("manualEntry.finishedHint")}</Text>
              </View>
              <Switch
                value={finished}
                onValueChange={setFinished}
                trackColor={{ false: colorScheme === "dark" ? "#52525b" : "#d1d5db", true: accent }}
                thumbColor={finished ? "#fff" : colorScheme === "dark" ? "#27272a" : "#f4f4f5"}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }}>{t("manualEntry.notesLabel")}</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={t("manualEntry.notesPlaceholder")}
                placeholderTextColor={subTextColor}
                style={{
                  backgroundColor: inputBackground,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  color: textColor,
                  fontSize: 16,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
                multiline
                maxLength={1000}
              />
            </View>
          </View>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={saving}
          style={({ pressed }) => ({
            backgroundColor: saving ? "#94a3b8" : accent,
            opacity: pressed || saving ? 0.8 : 1,
            paddingVertical: 16,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          })}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : null}
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
            {saving ? t("manualEntry.saving") : t("manualEntry.saveButton")}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={searchVisible}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
        onRequestClose={closeLessonSearch}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <SafeAreaView style={{ flex: 1, backgroundColor: background }} edges={["top", "bottom"]}>
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: textColor }}>{t("manualEntry.linkLessonTitle")}</Text>
                <Pressable
                  onPress={closeLessonSearch}
                  accessibilityRole="button"
                  accessibilityLabel={t("common.close")}
                  style={({ pressed }) => ({ padding: 6, borderRadius: 999, opacity: pressed ? 0.7 : 1 })}
                >
                  <MaterialIcons name="close" size={24} color={textColor} />
                </Pressable>
              </View>

              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t("manualEntry.linkLessonSearchPlaceholder")}
                placeholderTextColor={subTextColor}
                style={{
                  backgroundColor: inputBackground,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: textColor,
                  fontSize: 16,
                }}
                returnKeyType="search"
                autoFocus
              />

              {searchError ? (
                <Text style={{ color: colorScheme === "dark" ? "#f87171" : "#b91c1c" }}>{searchError}</Text>
              ) : null}

              {searchLoading ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={accent} />
                </View>
              ) : (
                <FlatList
                  data={resultsToShow}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ gap: 10, paddingBottom: 32, flexGrow: 1 }}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => handleSelectLessonFromSearch(item)}
                      style={({ pressed }) => ({
                        backgroundColor: pressed ? (colorScheme === "dark" ? "#2f2f36" : "#f1f5f9") : inputBackground,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        gap: 4,
                      })}
                    >
                      <Text style={{ fontSize: 16, fontWeight: "700", color: textColor }}>{item.title}</Text>
                      {item.courseTitle ? (
                        <Text style={{ fontSize: 13, color: subTextColor }}>{item.courseTitle}</Text>
                      ) : null}
                    </Pressable>
                  )}
                  ListHeaderComponent={() => (
                    <Text style={{ fontSize: 14, fontWeight: "600", color: subTextColor }}>
                      {trimmedSearchQuery.length > 0 ? t("manualEntry.linkLessonResultsLabel") : t("manualEntry.recentLessons")}
                    </Text>
                  )}
                  ListEmptyComponent={() => (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 24 }}>
                      <Text style={{ color: subTextColor, textAlign: "center" }}>
                        {trimmedSearchQuery.length > 0
                          ? t("manualEntry.linkLessonSearchEmpty")
                          : t("manualEntry.recentEmpty")}
                      </Text>
                    </View>
                  )}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {Platform.OS === "ios" && activePicker ? (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: contentBackground,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingTop: 12,
            borderWidth: 1,
            borderColor,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingBottom: 8 }}>
            <Pressable onPress={() => setActivePicker(null)}>
              <Text style={{ color: accent, fontWeight: "600" }}>{t("common.done")}</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={activePicker === "start" ? startAt : endAt}
            mode="datetime"
            display="spinner"
            onChange={(event, date) => handleChange(activePicker, event, date || undefined)}
            style={{ backgroundColor: contentBackground }}
          />
        </View>
      ) : null}
    </SafeAreaView>
  )
}
