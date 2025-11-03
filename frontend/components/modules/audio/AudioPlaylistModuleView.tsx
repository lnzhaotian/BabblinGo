import React, { useMemo } from "react"
import { Dimensions, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ThemedHeader } from "@/components/ThemedHeader"
import { CacheMenuModal } from "@/components/CacheMenuModal"
import { LessonHeaderControls } from "@/components/LessonHeaderControls"
import { AudioPlaylistModule } from "./AudioPlaylistModule"
import { useLessonCache } from "@/hooks/useLessonCache"
import { LessonDoc, ModuleDoc, extractModuleSlides } from "@/lib/payload"
import { useThemeMode } from "@/app/theme-context"

export type AudioPlaylistModuleViewProps = {
  lesson: LessonDoc
  module: ModuleDoc
}

export const AudioPlaylistModuleView: React.FC<AudioPlaylistModuleViewProps> = ({
  lesson,
  module,
}) => {
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode()
  const screenWidth = Dimensions.get("window").width

  const slide = useMemo(() => {
    const slides = extractModuleSlides(module)
    return slides[0] ?? null
  }, [module])

  const {
    cachedMedia,
    downloadProgress,
    cachingInProgress,
    lessonCacheStatus,
    cacheMenuVisible,
    setCacheMenuVisible,
    handleClearCache,
    handleRedownload,
  } = useLessonCache(lesson)

  return (
    <>
      <ThemedHeader
        overrideTitle={module.title || lesson.title}
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
        style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#fff" }}
        edges={["bottom"]}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}>
          {module.summary ? (
            <Text style={{ fontSize: 16, color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>
              {module.summary}
            </Text>
          ) : null}

          {slide ? (
            <AudioPlaylistModule
              slide={slide}
              screenWidth={screenWidth - 40}
              cachedMedia={cachedMedia}
              downloadProgress={downloadProgress}
            />
          ) : (
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: colorScheme === "dark" ? "#1e293b" : "#f1f5f9" }}>
              <Text style={{ color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>
                {t("lesson.audio.emptyPlaylist", { defaultValue: "No tracks available." })}
              </Text>
            </View>
          )}
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
