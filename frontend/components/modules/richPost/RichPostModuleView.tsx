import React, { useMemo } from "react"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { Image } from "expo-image"

import { LessonDoc, ModuleDoc, extractModuleSlides, resolveMediaUrl } from "@/lib/payload"
import { useThemeMode } from "@/app/theme-context"
import { useLearningSession } from "@/hooks/useLearningSession"
import { useLessonCache } from "@/hooks/useLessonCache"
import { ThemedHeader } from "@/components/ThemedHeader"
import { LessonHeaderControls } from "@/components/LessonHeaderControls"
import { CacheMenuModal } from "@/components/CacheMenuModal"
import { LexicalContent } from "@/components/LexicalContent"

export type RichPostModuleViewProps = {
  lesson: LessonDoc
  module: ModuleDoc
}

export const RichPostModuleView: React.FC<RichPostModuleViewProps> = ({
  lesson,
  module,
}) => {
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode()

  useLearningSession(lesson.id, lesson.title, {
    enabled: false,
    courseId: typeof lesson.course === 'string' ? lesson.course : lesson.course.id,
    defaultTrackingEnabled: typeof lesson.course === 'object' ? (lesson.course.defaultTrackingEnabled ?? undefined) : undefined,
  })

  const slide = useMemo(() => {
    const slides = extractModuleSlides(module)
    return slides[0] ?? null
  }, [module])

  const {
    cachedMedia,
    cachingInProgress,
    lessonCacheStatus,
    cacheMenuVisible,
    setCacheMenuVisible,
    handleClearCache,
    handleRedownload,
  } = useLessonCache(lesson)

  const bodyContent = useMemo(
    () => slide?.body ?? module.richPost?.body ?? null,
    [slide?.body, module.richPost?.body]
  )

  const resolvedGallery = useMemo(() => {
    const galleryEntries = module.richPost?.mediaGallery ?? slide?.richPost?.mediaGallery ?? []

    return galleryEntries.map((entry) => {
      const originalUrl = resolveMediaUrl(entry.media)
      const cachedUrl = originalUrl ? cachedMedia[originalUrl] ?? originalUrl : null
      return {
        id: entry.id ?? originalUrl ?? "gallery-entry",
        url: cachedUrl,
        caption: entry.caption ?? null,
      }
    })
  }, [module.richPost?.mediaGallery, slide?.richPost?.mediaGallery, cachedMedia])

  return (
    <>
      <ThemedHeader
        overrideTitle=""
        headerRight={() => (
          <LessonHeaderControls
            loopEnabled={false}
            cachingInProgress={cachingInProgress}
            cacheStatus={lessonCacheStatus}
            onToggleLoop={() => {}}
            onOpenCacheMenu={() => setCacheMenuVisible(true)}
            showLoopToggle={false}
          />
        )}
      />
      <SafeAreaView
      style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#18181b" : "#fff" }}
      edges={["bottom"]}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}>
        {/* Title and Summary Section */}
        <View style={{ gap: 12 }}>
          <Text 
            style={{ 
              fontSize: 28, 
              fontWeight: "700",
              color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a",
              lineHeight: 36,
              textAlign: "center",
            }}
          >
            {module.title}
          </Text>
          
          {module.summary ? (
            <Text 
              style={{ 
                fontSize: 16, 
                color: colorScheme === "dark" ? "#cbd5e1" : "#64748b",
                lineHeight: 24,
              }}
            >
              {module.summary}
            </Text>
          ) : null}
        </View>

        {bodyContent ? (
          <LexicalContent
            content={bodyContent}
            cachedMedia={cachedMedia}
            colorScheme={colorScheme}
            fontSize={17}
            lineHeight={26}
          />
        ) : (
          <View style={{ padding: 16, borderRadius: 12, backgroundColor: colorScheme === "dark" ? "#1e293b" : "#f1f5f9" }}>
            <Text style={{ color: colorScheme === "dark" ? "#94a3b8" : "#64748b" }}>
              {t("lesson.richPost.empty", { defaultValue: "No content has been added yet." })}
            </Text>
          </View>
        )}

        {resolvedGallery.length > 0 ? (
          <View style={{ gap: 16 }}>
            {resolvedGallery.map((entry) => {
              if (!entry.url) {
                return null
              }
              return (
                <View key={entry.id} style={{ gap: 8 }}>
                  <Image
                    source={{ uri: entry.url }}
                    style={{ width: "100%", aspectRatio: 3 / 2, borderRadius: 18, backgroundColor: "#0f172a" }}
                    contentFit="cover"
                  />
                  {entry.caption ? (
                    <Text style={{ color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>{entry.caption}</Text>
                  ) : null}
                </View>
              )
            })}
          </View>
        ) : null}
      </ScrollView>

      <CacheMenuModal
        visible={cacheMenuVisible}
        onClose={() => setCacheMenuVisible(false)}
        cacheStatus={lessonCacheStatus}
        onRedownload={handleRedownload}
        onClear={handleClearCache}
      />
    </SafeAreaView>
  </>
)
}
