import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { useTranslation } from "react-i18next"

import { ThemedHeader } from "@/components/ThemedHeader"
import { useThemeMode } from "@/app/theme-context"
import { fetchLessonById, getLessonModules, LessonDoc, LessonModuleType, ModuleDoc } from "@/lib/payload"

const typeLabels: Record<LessonModuleType, (t: ReturnType<typeof useTranslation>["t"]) => string> = {
  audioSlideshow: (t) => t("lesson.modules.audioSlideshow", { defaultValue: "Audio Slideshow" }),
  video: (t) => t("lesson.modules.video", { defaultValue: "Video" }),
  richPost: (t) => t("lesson.modules.richPost", { defaultValue: "Reading" }),
  audio: (t) => t("lesson.modules.audio", { defaultValue: "Audio Playlist" }),
}

const getModuleTypeLabel = (module: ModuleDoc, t: ReturnType<typeof useTranslation>["t"]): string => {
  const type = module.type ?? "audioSlideshow"
  const formatter = typeLabels[type as LessonModuleType]
  return formatter ? formatter(t) : type
}

type LessonRouteParams = {
  lessonId?: string
  title?: string
}

type ModuleCardProps = {
  module: ModuleDoc
  index: number
  onPress: (module: ModuleDoc) => void
  t: ReturnType<typeof useTranslation>["t"]
}

const LessonModuleCard: React.FC<ModuleCardProps> = ({ module, index, onPress, t }) => {
  const moduleTypeLabel = getModuleTypeLabel(module, t)
  return (
    <Pressable
      onPress={() => onPress(module)}
      style={({ pressed }) => ({
        borderRadius: 16,
        padding: 20,
        backgroundColor: "#1f2937",
        opacity: pressed ? 0.88 : 1,
        marginBottom: 16,
      })}
    >
      <Text style={{ color: "#9ca3af", fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase" }}>
        {t("lesson.modules.position", { defaultValue: "Module {{index}}", index: index + 1 })}
      </Text>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700", marginTop: 6 }}>
        {module.title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 12 }}>
        <View style={{ backgroundColor: "#312e81", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
          <Text style={{ color: "#c7d2fe", fontSize: 12, fontWeight: "600" }}>{moduleTypeLabel}</Text>
        </View>
        {module.summary ? (
          <Text style={{ color: "#d1d5db", flex: 1 }} numberOfLines={2}>
            {module.summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const LessonModuleListScreen: React.FC = () => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { lessonId, title: routeTitle } = useLocalSearchParams<LessonRouteParams>()

  const [lesson, setLesson] = useState<LessonDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoNavigated, setAutoNavigated] = useState(false)

  const { colorScheme } = useThemeMode()

  useEffect(() => {
    setAutoNavigated(false)
  }, [lessonId])

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
        console.error("Failed to load lesson", err)
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
  const isSingleModuleLesson = !loading && !error && Boolean(lesson) && modules.length === 1

  useEffect(() => {
    if (!lessonId || autoNavigated || !isSingleModuleLesson) {
      return
    }

    const soleModule = modules[0]
    if (soleModule) {
      setAutoNavigated(true)
      router.replace({
        pathname: "/lesson/[lessonId]/module/[moduleId]",
        params: {
          lessonId,
          moduleId: soleModule.id,
          moduleTitle: soleModule.title,
          lessonTitle: lesson?.title ?? (typeof routeTitle === "string" ? routeTitle : undefined),
          isSingleModuleLesson: "true",
        },
      } as any)
    }
  }, [lessonId, modules, autoNavigated, router, isSingleModuleLesson, lesson, routeTitle])

  const handleModulePress = useCallback((module: ModuleDoc) => {
    if (!lessonId) return
    router.push({
      pathname: "/lesson/[lessonId]/module/[moduleId]",
      params: {
        lessonId,
        moduleId: module.id,
        moduleTitle: module.title,
        lessonTitle: lesson?.title ?? (typeof routeTitle === "string" ? routeTitle : undefined),
        isSingleModuleLesson: "false",
      },
    } as any)
  }, [lessonId, router, lesson, routeTitle])

  const headerTitle = lesson?.title || (typeof routeTitle === "string" && routeTitle) || (lessonId ? String(lessonId) : t("lesson.title", { defaultValue: "Lesson" }))

  if (isSingleModuleLesson) {
    return null
  }

  return (
    <>
      <ThemedHeader overrideTitle={headerTitle} />
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#111827" : "#f3f4f6" }}
        edges={["bottom"]}
      >
        {loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }}>
            <ActivityIndicator size="large" />
            <Text style={{ color: colorScheme === "dark" ? "#e5e7eb" : "#4b5563" }}>
              {t("lesson.loading", { defaultValue: "Loading lesson..." })}
            </Text>
          </View>
        ) : error ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
            <Text style={{ color: colorScheme === "dark" ? "#fca5a5" : "#b91c1c", textAlign: "center" }}>{error}</Text>
          </View>
        ) : !lesson ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
            <Text style={{ color: colorScheme === "dark" ? "#e5e7eb" : "#4b5563", textAlign: "center" }}>
              {t("lesson.notFound", { defaultValue: "Lesson not found." })}
            </Text>
          </View>
        ) : modules.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
            <Text style={{ color: colorScheme === "dark" ? "#e5e7eb" : "#4b5563", textAlign: "center" }}>
              {t("lesson.noModules", { defaultValue: "This lesson does not have any modules yet." })}
            </Text>
          </View>
        ) : (
          <FlatList
            contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
            data={modules}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <LessonModuleCard module={item} index={index} onPress={handleModulePress} t={t} />
            )}
          />
        )}
      </SafeAreaView>
    </>
  )
}

export default LessonModuleListScreen
