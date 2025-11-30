import React, { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, FlatList, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ThemedHeader } from "@/components/ThemedHeader"
import { LessonHeaderControls } from "@/components/LessonHeaderControls"
import { CacheMenuModal } from "@/components/CacheMenuModal"
import { PaginationDots } from "@/components/PaginationDots"
import { LessonAudioPlayer } from "@/components/LessonAudioPlayer"
import { LessonSessionResult } from "@/components/LessonSessionResult"
import { LessonSlide } from "@/components/LessonSlide"
import { PronunciationModal } from "@/components/PronunciationModal"
import { useLessonPreferences } from "@/hooks/useLessonPreferences"
import { useLessonCache } from "@/hooks/useLessonCache"
import { useLessonNavigation } from "@/hooks/useLessonNavigation"
import { useSlideAudio } from "@/hooks/useSlideAudio"
import { useLearningSession } from "@/hooks/useLearningSession"
import { useThemeMode } from "@/app/theme-context"
import {
  extractModuleSlides,
  extractPlainText,
  LessonDoc,
  LessonModuleSlide,
  ModuleDoc,
  resolveMediaUrl,
} from "@/lib/payload"

export type AudioSlideshowModuleViewProps = {
  lesson: LessonDoc
  module: ModuleDoc
  lessonId: string
  onExit: () => void
}

const renderSlide = (
  slide: LessonModuleSlide,
  index: number,
  screenWidth: number,
  cachedMedia: Record<string, string>,
  downloadProgress: Record<string, number>
) => {
  const imageUrl = resolveMediaUrl(slide.image)
  return (
    <LessonSlide
      item={slide}
      index={index}
      screenWidth={screenWidth}
      imageUrl={imageUrl}
      cachedMedia={cachedMedia}
      downloadProgress={downloadProgress}
    />
  )
}

export const AudioSlideshowModuleView: React.FC<AudioSlideshowModuleViewProps> = ({
  lesson,
  module,
  lessonId,
  onExit,
}) => {
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode()
  const slides = useMemo(() => extractModuleSlides(module), [module])

  const {
    playerSpeed,
    setPlayerSpeed,
    loopEnabled,
    setLoopEnabled,
    defaultMode,
    prefsLoaded,
  } = useLessonPreferences()

  const [practiceMode, setPracticeMode] = useState(false)
  const [pronunciationModalVisible, setPronunciationModalVisible] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [replayTrigger, setReplayTrigger] = useState(0)
  const practiceModeInitializedRef = React.useRef(false)

  React.useEffect(() => {
    if (prefsLoaded && !practiceModeInitializedRef.current) {
      setPracticeMode(defaultMode === "listen-and-repeat")
      practiceModeInitializedRef.current = true
    }
  }, [prefsLoaded, defaultMode])

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

  const supportsLearningSession = slides.length > 0
  const effectiveLoopEnabled = supportsLearningSession ? loopEnabled : false

  const { hasAudio, slideAudio } = useSlideAudio(slides, cachedMedia)

  const {
    currentSlideIndex,
    flatListRef,
    screenWidth,
    onSlideScroll,
    handleNavigate,
    handleTrackFinish,
    resetToFirstSlide,
  } = useLessonNavigation({
    totalSlides: slides.length,
    hasAudio,
    loopEnabled: effectiveLoopEnabled,
  })

  const currentSlide = slides[currentSlideIndex] ?? null

  const showAudioPlayer = currentSlide?.type === "audioSlideshow"
    && Boolean(slideAudio[currentSlideIndex]?.audioUrl)

  const {
    mode,
    configuredSeconds,
    elapsedSeconds,
    restartSession,
    sessionReady,
  } = useLearningSession(lessonId, lesson.title, {
    speed: playerSpeed,
    loop: loopEnabled,
    enabled: supportsLearningSession,
    courseId: typeof lesson.course === 'string' ? lesson.course : lesson.course.id,
    defaultTrackingEnabled: typeof lesson.course === 'object' ? (lesson.course.defaultTrackingEnabled ?? undefined) : undefined,
  })

  const showSessionResult = supportsLearningSession && mode === "results"
  const showSessionLanding = supportsLearningSession && (!sessionReady || mode === "landing")

  const handleRestartSession = useCallback(() => {
    resetToFirstSlide()
    restartSession()
  }, [resetToFirstSlide, restartSession])

  const handleAudioFinish = useCallback(() => {
    console.log("handleAudioFinish called. practiceMode:", practiceMode)
    if (practiceMode) {
      const currentSlide = slides[currentSlideIndex]
      // Use body (slide text) instead of transcript (module text)
      const textToPractice = extractPlainText(currentSlide?.body)
      console.log("Text found:", !!textToPractice, textToPractice?.substring(0, 20))
      
      if (textToPractice) {
        console.log("Opening pronunciation modal")
        setPronunciationModalVisible(true)
        return false
      } else {
        console.log("No text content, skipping practice")
      }
    }
    
    return handleTrackFinish()
  }, [practiceMode, slides, currentSlideIndex, handleTrackFinish])

  const handlePronunciationSuccess = useCallback(() => {
    setPronunciationModalVisible(false)
    setRetryCount(0)
    handleTrackFinish()
  }, [handleTrackFinish])

  const handlePronunciationFail = useCallback(() => {
    setPronunciationModalVisible(false)
    const MAX_RETRIES = 3
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1)
      setReplayTrigger(prev => prev + 1)
    } else {
      setRetryCount(0)
      handleTrackFinish()
    }
  }, [retryCount, handleTrackFinish])

  const handlePronunciationClose = useCallback(() => {
      setPronunciationModalVisible(false)
      handleTrackFinish()
  }, [handleTrackFinish])

  return (
    <>
      <ThemedHeader
        overrideTitle=""
        headerRight={() => (
          showSessionLanding
            ? undefined
            : (
              <LessonHeaderControls
                loopEnabled={effectiveLoopEnabled}
                cachingInProgress={cachingInProgress}
                cacheStatus={lessonCacheStatus}
                onToggleLoop={() => setLoopEnabled(!loopEnabled)}
                onOpenCacheMenu={() => setCacheMenuVisible(true)}
                showLoopToggle={supportsLearningSession}
                practiceModeEnabled={practiceMode}
                onTogglePracticeMode={() => setPracticeMode(!practiceMode)}
                showPracticeToggle={supportsLearningSession}
              />
            )
        )}
      />

      {showSessionResult ? (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#18181b" : "#fff" }}
          edges={["bottom"]}
        >
          <LessonSessionResult
            elapsedSec={elapsedSeconds}
            plannedSec={configuredSeconds}
            onExit={onExit}
            onRestart={handleRestartSession}
          />
        </SafeAreaView>
      ) : (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#18181b" : "#fff" }}
          edges={["bottom"]}
        >
          {showSessionLanding ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }}>
              <ActivityIndicator size="large" />
              <Text style={{ color: colorScheme === "dark" ? "#e5e7eb" : "#475569" }}>
                {t("lesson.loading", { defaultValue: "Loading..." })}
              </Text>
            </View>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <FlatList
                  ref={flatListRef}
                  data={slides}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item, index }) => renderSlide(item, index, screenWidth, cachedMedia, downloadProgress)}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onSlideScroll}
                  getItemLayout={(_, index) => ({
                    length: screenWidth,
                    offset: screenWidth * index,
                    index,
                  })}
                />

                <PaginationDots total={slides.length} currentIndex={currentSlideIndex} />
              </View>

              {showAudioPlayer ? (
                <LessonAudioPlayer
                  track={slideAudio[currentSlideIndex]?.audioUrl
                    ? {
                      id: slideAudio[currentSlideIndex].id,
                      title: (slideAudio[currentSlideIndex].title ?? "") as string,
                      audioUrl: slideAudio[currentSlideIndex].audioUrl as string,
                    }
                    : null}
                  playerSpeed={playerSpeed}
                  loopEnabled={effectiveLoopEnabled}
                  hasPrev={currentSlideIndex > 0 || effectiveLoopEnabled}
                  hasNext={currentSlideIndex < slides.length - 1 || effectiveLoopEnabled}
                  onSpeedChange={setPlayerSpeed}
                  onNavigate={handleNavigate}
                  onFinish={handleAudioFinish}
                  replayTrigger={replayTrigger}
                  disableInternalLoop={practiceMode}
                  suspend={pronunciationModalVisible}
                />
              ) : null}
            </>
          )}

          <CacheMenuModal
            visible={cacheMenuVisible}
            onClose={() => setCacheMenuVisible(false)}
            cacheStatus={lessonCacheStatus}
            onRedownload={handleRedownload}
            onClear={handleClearCache}
          />

          <PronunciationModal
            visible={pronunciationModalVisible}
            transcript={extractPlainText(slides[currentSlideIndex]?.body)}
            onSuccess={handlePronunciationSuccess}
            onFail={handlePronunciationFail}
            onClose={handlePronunciationClose}
          />
        </SafeAreaView>
      )}
    </>
  )
}
