import React, { useEffect, useRef, useState } from "react"
import {
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useLocalSearchParams, useRouter } from "expo-router"
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker"
import { useThemeMode } from "../../theme-context"
import { updateLearningSession, getLearningSessions } from "@/lib/session-manager"
import { deleteLearningRecord } from "@/lib/learning-sync"
import { ThemedHeader } from "@/components/ThemedHeader"
import type { SessionRecord } from "@/lib/learning-types"
import { fetchLessonById, resolveLocalizedField } from "@/lib/payload"

const MIN_DURATION_MS = 60 * 1000
const MAX_DURATION_MS = 8 * 60 * 60 * 1000

type PickerTarget = "start" | "end"

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

export default function HistoryDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const { colorScheme } = useThemeMode()

  const [session, setSession] = useState<SessionRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resolvedTitle, setResolvedTitle] = useState<string | null>(null)

  // Edit state
  const [notes, setNotes] = useState("")
  const [startAt, setStartAt] = useState<Date>(new Date())
  const [endAt, setEndAt] = useState<Date>(new Date())
  const [activePicker, setActivePicker] = useState<PickerTarget | null>(null)
  const scrollViewRef = useRef<ScrollView>(null)

  const background = colorScheme === "dark" ? "#18181b" : "#f9fafb"
  const contentBackground = colorScheme === "dark" ? "#23232a" : "#fff"
  const textColor = colorScheme === "dark" ? "#f4f4f5" : "#111827"
  const subTextColor = colorScheme === "dark" ? "#a1a1aa" : "#6b7280"
  const inputBackground = colorScheme === "dark" ? "#2f2f36" : "#f3f4f6"
  const borderColor = colorScheme === "dark" ? "#3f3f46" : "#e5e7eb"
  const accent = "#6366f1"
  const danger = "#ef4444"

  useEffect(() => {
    const loadSession = async () => {
      if (!id) return
      try {
        const sessions = await getLearningSessions()
        const found = sessions.find(s => s.id === id)
        if (found) {
          setSession(found)
          setNotes(found.notes || "")
          setStartAt(new Date(found.startedAt))
          setEndAt(new Date(found.endedAt))

          // Fetch localized title if it's a real lesson
          if (found.lessonId && found.lessonId !== "manual-entry") {
            try {
              const lessonDoc = await fetchLessonById(found.lessonId, i18n.language)
              if (lessonDoc) {
                // @ts-ignore - title might be an object at runtime despite type definition
                const title = resolveLocalizedField(lessonDoc.title, i18n.language)
                setResolvedTitle(title ?? null)
              }
            } catch (err) {
              console.warn("Failed to fetch lesson details for history item:", err)
            }
          }
        } else {
          Alert.alert(t("common.error"), t("lesson.notFound"), [
            { text: t("common.done"), onPress: () => router.back() }
          ])
        }
      } catch (error) {
        console.error("Failed to load session:", error)
      } finally {
        setLoading(false)
      }
    }
    loadSession()
  }, [id, t, router, i18n.language])

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
      startMs,
      endMs,
    }
  }

  const handleSave = async () => {
    if (!session) return
    const payload = validate()
    if (!payload) return

    setSaving(true)
    try {
      await updateLearningSession(session.id, {
        startedAt: payload.startMs,
        endedAt: payload.endMs,
        notes: notes.trim() || null,
      })

      // Update local state
      setSession(prev => prev ? ({
        ...prev,
        startedAt: payload.startMs,
        endedAt: payload.endMs,
        notes: notes.trim() || null,
        durationSeconds: Math.floor((payload.endMs - payload.startMs) / 1000)
      }) : null)

      setIsEditing(false)
      setActivePicker(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : null
      Alert.alert(t("common.error"), message ?? t("manualEntry.error.generic"))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!session) return
    Alert.alert(
      t("manualEntry.deleteTitle"),
      t("manualEntry.deleteConfirmation"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteLearningRecord(session.id, session.serverId)
              router.back()
            } catch (error) {
              console.error("Failed to delete session:", error)
              Alert.alert(t("common.error"), t("manualEntry.error.generic"))
            }
          }
        }
      ]
    )
  }

  const displayTitle = resolvedTitle || session?.lessonTitle || t("history.untitledSession")
  const durationStr = session ? Math.floor((session.durationSeconds || 0) / 60) + "m" : ""

  return (
    <>
      <ThemedHeader
        headerRight={!isEditing ? () => (
          <Pressable
            onPress={() => setIsEditing(true)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ color: colorScheme === 'dark' ? "#fff" : "#18181b", fontWeight: "600", fontSize: 16, marginHorizontal: 8 }}>{t("common.tapToEdit")}</Text>
          </Pressable>
        ) : undefined}
      />
      <SafeAreaView style={{ flex: 1, backgroundColor: background }} edges={["bottom", "left", "right"]}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView ref={scrollViewRef} contentContainerStyle={{ padding: 20, gap: 16 }}>
            {!isEditing && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 14, color: subTextColor }}>
                  {session ? formatDateTime(new Date(session.startedAt), i18n.language) : ""} • {durationStr}
                </Text>
              </View>
            )}

            <View style={{ backgroundColor: contentBackground, borderRadius: 16, padding: 16, borderWidth: 1, borderColor }}>
              <View style={{ gap: 12 }}>
                {isEditing ? (
                  <>
                    <View>
                      <Text style={{ fontSize: 20, fontWeight: "700", color: textColor }}>
                        {displayTitle}
                      </Text>
                    </View>

                    <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 8 }} />
                    
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
                    </View>

                    <View style={{ gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }}>{t("manualEntry.notesLabel")}</Text>
                      <TextInput
                        value={notes}
                        onChangeText={setNotes}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollToEnd({ animated: true })
                          }, 300)
                        }}
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
                  </>
                ) : (
                  <>
                    <View>
                      <Text style={{ fontSize: 20, fontWeight: "700", color: textColor }}>
                        {displayTitle}
                      </Text>
                    </View>

                    <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 8 }} />

                    <View style={{ gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: subTextColor }}>{t("manualEntry.notesLabel")}</Text>
                      <Text style={{ fontSize: 16, color: textColor, lineHeight: 24 }}>
                        {(session?.notes ?? t("progress.noData"))}
                      </Text>
                    </View>

                    <View style={{ height: 1, backgroundColor: borderColor, marginVertical: 8 }} />

                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <View>
                        <Text style={{ fontSize: 12, color: subTextColor, marginBottom: 4 }}>{t("manualEntry.startLabel")}</Text>
                        <Text style={{ fontSize: 14, color: textColor }}>
                          {session ? formatDateTime(new Date(session.startedAt), i18n.language) : ""}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontSize: 12, color: subTextColor, marginBottom: 4 }}>{t("manualEntry.endLabel")}</Text>
                        <Text style={{ fontSize: 14, color: textColor }}>
                          {session ? formatDateTime(new Date(session.endedAt), i18n.language) : ""}
                        </Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>

            {isEditing && (
              <View style={{ gap: 12 }}>
                <Pressable
                  onPress={handleSave}
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
                  {saving ? <ActivityIndicator color="#fff" /> : null}
                  <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>
                    {saving ? t("manualEntry.saving") : t("profile.save")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleDelete}
                  style={({ pressed }) => ({
                    backgroundColor: "transparent",
                    opacity: pressed ? 0.7 : 1,
                    paddingVertical: 16,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: danger,
                  })}
                >
                  <Text style={{ color: danger, fontSize: 16, fontWeight: "700" }}>
                    {t("chat.delete")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setIsEditing(false)
                    setActivePicker(null)
                    // Reset form
                    if (session) {
                      setNotes(session.notes || "")
                      setStartAt(new Date(session.startedAt))
                      setEndAt(new Date(session.endedAt))
                    }
                  }}
                  style={{ alignItems: "center", padding: 8 }}
                >
                  <Text style={{ color: subTextColor, fontSize: 14 }}>{t("common.cancel")}</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

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
    </>
  )
}
