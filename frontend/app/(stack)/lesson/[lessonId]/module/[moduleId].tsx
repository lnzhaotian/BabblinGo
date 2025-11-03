import React, { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { useThemeMode } from "@/app/theme-context"
import { ThemedHeader } from "@/components/ThemedHeader"
import { AudioPlaylistModuleView } from "@/components/modules/audio/AudioPlaylistModuleView"
import { AudioSlideshowModuleView } from "@/components/modules/audioSlideshow/AudioSlideshowModuleView"
import { RichPostModuleView } from "@/components/modules/richPost/RichPostModuleView"
import { VideoModuleView } from "@/components/modules/video/VideoModuleView"
import { fetchLessonById, getLessonModules, LessonDoc } from "@/lib/payload"

const FALLBACK_ERROR = "Unknown module"

type RouteParams = {
  lessonId?: string
  moduleId?: string
  moduleTitle?: string
  lessonTitle?: string
  isSingleModuleLesson?: string
}

const ModuleDetailScreen: React.FC = () => {
  const {
    lessonId,
    moduleId,
    moduleTitle: moduleTitleParam,
    lessonTitle: lessonTitleParam,
    isSingleModuleLesson: isSingleModuleLessonParam,
  } = useLocalSearchParams<RouteParams>()
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { colorScheme } = useThemeMode()

  const [lesson, setLesson] = useState<LessonDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!lessonId) {
      setError(t("lesson.errorMissingId", { defaultValue: "Lesson identifier is missing." }))
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        const data = await fetchLessonById(lessonId, i18n.language)
        if (!cancelled) {
          setLesson(data)
          setError(null)
        }
      } catch (err) {
        console.error("Failed to load module", err)
        if (!cancelled) {
          setError(t("lesson.error", { defaultValue: "Unable to load lesson." }))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [lessonId, i18n.language, t])

  const modules = useMemo(() => (lesson ? getLessonModules(lesson) : []), [lesson])
  const activeModule = useMemo(() => modules.find((item) => item.id === moduleId) ?? null, [modules, moduleId])

  const routeModuleTitle = typeof moduleTitleParam === "string" ? moduleTitleParam : undefined
  const routeLessonTitle = typeof lessonTitleParam === "string" ? lessonTitleParam : undefined
  const routeSingleModule = useMemo(() => {
    if (typeof isSingleModuleLessonParam !== "string") return false
    const normalized = isSingleModuleLessonParam.trim().toLowerCase()
    return normalized === "true" || normalized === "1" || normalized === "yes"
  }, [isSingleModuleLessonParam])

  const fallbackTitle = useMemo(() => {
    if (routeLessonTitle) return routeLessonTitle
    if (lesson?.title) return lesson.title
    if (routeModuleTitle && !routeSingleModule) return routeModuleTitle
    if (typeof moduleId === "string") return moduleId
    if (typeof lessonId === "string") return lessonId
    return t("lesson.title", { defaultValue: "Lesson" })
  }, [lesson, lessonId, moduleId, routeLessonTitle, routeModuleTitle, routeSingleModule, t])

  const resolvedLessonTitle = lesson?.title ?? routeLessonTitle
  const resolvedModuleTitle = activeModule?.title ?? routeModuleTitle

  const shouldPreferLessonTitle = useMemo(() => {
    if (lesson) {
      return modules.length === 1
    }
    return routeSingleModule
  }, [lesson, modules.length, routeSingleModule])

  const headerTitle = useMemo(() => {
    if (lesson) {
      if (modules.length === 1) {
        return resolvedLessonTitle ?? fallbackTitle
      }
      if (modules.length > 1) {
        return resolvedModuleTitle ?? resolvedLessonTitle ?? fallbackTitle
      }
    }
    if (shouldPreferLessonTitle) {
      return resolvedLessonTitle ?? fallbackTitle
    }
    return resolvedModuleTitle ?? resolvedLessonTitle ?? fallbackTitle
  }, [lesson, modules.length, resolvedLessonTitle, resolvedModuleTitle, fallbackTitle, shouldPreferLessonTitle])

  const handleBackToList = () => {
    router.back()
  }

  const header = <ThemedHeader overrideTitle={headerTitle} />

  if (loading) {
    return (
      <>
        {header}
        <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#fff" }} edges={["bottom"]}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }}>
            <ActivityIndicator size="large" />
            <Text style={{ color: colorScheme === "dark" ? "#e2e8f0" : "#475569" }}>
              {t("lesson.loading", { defaultValue: "Loading..." })}
            </Text>
          </View>
        </SafeAreaView>
      </>
    )
  }

  if (error || !lesson || !activeModule) {
    return (
      <>
        {header}
        <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#fff" }} edges={["bottom"]}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, gap: 12 }}>
            <Text style={{ color: colorScheme === "dark" ? "#fca5a5" : "#dc2626", textAlign: "center" }}>
              {error ?? FALLBACK_ERROR}
            </Text>
            <Text
              onPress={() => router.back()}
              style={{ color: colorScheme === "dark" ? "#93c5fd" : "#2563eb", textDecorationLine: "underline" }}
            >
              {t("lesson.modules.backToList", { defaultValue: "Back to modules" })}
            </Text>
          </View>
        </SafeAreaView>
      </>
    )
  }

  if (!moduleId) {
    return (
      <>
        {header}
        <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#fff" }} edges={["bottom"]}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
            <Text style={{ color: colorScheme === "dark" ? "#e2e8f0" : "#1f2937", textAlign: "center" }}>
              {t("lesson.errorMissingModuleId", { defaultValue: "Module identifier is missing." })}
            </Text>
          </View>
        </SafeAreaView>
      </>
    )
  }

  if (!lessonId) {
    return (
      <>
        {header}
        <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#fff" }} edges={["bottom"]}>
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
            <Text style={{ color: colorScheme === "dark" ? "#e2e8f0" : "#1f2937", textAlign: "center" }}>
              {t("lesson.errorMissingId", { defaultValue: "Lesson identifier is missing." })}
            </Text>
          </View>
        </SafeAreaView>
      </>
    )
  }

  switch (activeModule.type ?? "audioSlideshow") {
    case "audioSlideshow":
      return (
        <>
          {header}
          <AudioSlideshowModuleView
            lesson={lesson}
            module={activeModule}
            lessonId={lessonId}
            onExit={handleBackToList}
          />
        </>
      )
    case "video":
      return (
        <>
          {header}
          <VideoModuleView
            lesson={lesson}
            module={activeModule}
          />
        </>
      )
    case "richPost":
      return (
        <>
          {header}
          <RichPostModuleView
            lesson={lesson}
            module={activeModule}
          />
        </>
      )
    case "audio":
      return (
        <>
          {header}
          <AudioPlaylistModuleView
            lesson={lesson}
            module={activeModule}
          />
        </>
      )
    default:
      return (
        <>
          {header}
          <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#fff" }} edges={["bottom"]}>
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, gap: 12 }}>
              <Text style={{ color: colorScheme === "dark" ? "#e2e8f0" : "#1f2937", textAlign: "center" }}>
                {t("lesson.modules.unsupported", { defaultValue: "This module type is not supported yet." })}
              </Text>
              <Text
                onPress={handleBackToList}
                style={{ color: colorScheme === "dark" ? "#93c5fd" : "#2563eb", textDecorationLine: "underline" }}
              >
                {t("lesson.modules.backToList", { defaultValue: "Back to modules" })}
              </Text>
            </View>
          </SafeAreaView>
        </>
      )
  }
}

export default ModuleDetailScreen
