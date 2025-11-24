import React, { useMemo, useState } from "react"
import { Alert, Platform, ScrollView, Text, TextInput, View, Pressable, Switch, ActivityIndicator } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { useRouter } from "expo-router"
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker"
import { useThemeMode } from "../theme-context"
import { saveLearningSession } from "@/lib/session-manager"
import type { PlaybackSpeed } from "@/components/SingleTrackPlayer"
import { MaterialIcons } from "@expo/vector-icons"

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

  const background = colorScheme === "dark" ? "#18181b" : "#f9fafb"
  const contentBackground = colorScheme === "dark" ? "#23232a" : "#fff"
  const textColor = colorScheme === "dark" ? "#f4f4f5" : "#111827"
  const subTextColor = colorScheme === "dark" ? "#a1a1aa" : "#6b7280"
  const inputBackground = colorScheme === "dark" ? "#2f2f36" : "#f3f4f6"
  const borderColor = colorScheme === "dark" ? "#3f3f46" : "#e5e7eb"
  const accent = "#6366f1"

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
    const trimmedTitle = lessonTitle.trim()
    if (trimmedTitle.length === 0) {
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
      title: trimmedTitle,
      lessonId: lessonId.trim(),
      startMs,
      endMs,
      durationMs,
    }
  }

  const handleSubmit = async () => {
    const payload = validate()
    if (!payload) return

    const { title, lessonId: providedLessonId, startMs, endMs, durationMs } = payload
    const durationSeconds = Math.round(durationMs / 1000)
    const manualLessonId = providedLessonId.length > 0 ? providedLessonId : `manual-${slugify(title) || "session"}-${Date.now().toString(36)}`

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

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: textColor }}>{t("manualEntry.lessonIdLabel")}</Text>
              <TextInput
                value={lessonId}
                onChangeText={setLessonId}
                placeholder={t("manualEntry.lessonIdPlaceholder")}
                placeholderTextColor={subTextColor}
                style={{
                  backgroundColor: inputBackground,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  color: textColor,
                  fontSize: 16,
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
              <Text style={{ fontSize: 12, color: subTextColor }}>{t("manualEntry.lessonIdHint")}</Text>
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
