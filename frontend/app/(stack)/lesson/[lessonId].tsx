import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, FlatList, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Stack, useLocalSearchParams, useRouter } from "expo-router"
import { useThemeMode } from "../../theme-context";

import { extractModules, fetchLessonById, LessonDoc, resolveMediaUrl } from "@/lib/payload"
// SingleTrackPlayer is wrapped by LessonAudioPlayer
import { useTranslation } from "react-i18next"

import { LessonSlide } from "@/components/LessonSlide"
import { CacheMenuModal } from "@/components/CacheMenuModal"
import { PaginationDots } from "@/components/PaginationDots"
import { useLessonPreferences } from "@/hooks/useLessonPreferences"
import { useLessonCache } from "@/hooks/useLessonCache"
import { useLessonNavigation } from "@/hooks/useLessonNavigation"
import { LessonAudioPlayer } from "@/components/LessonAudioPlayer"
import { useSlideAudio } from "@/hooks/useSlideAudio"
import { LessonHeaderControls } from "@/components/LessonHeaderControls"
import { useLearningSession } from "@/hooks/useLearningSession"
import { LessonLandingCard } from "@/components/LessonLandingCard"
import { LessonCountdownTimer } from "@/components/LessonCountdownTimer"
import { LessonSessionResult } from "@/components/LessonSessionResult"
// useRouter imported above with Stack

/**
 * Lesson detail screen – Audio + Slides architecture
 *
 * Key design choices (keep these in sync if you refactor):
 * 1) Parent-controlled state (single source of truth):
 *    - loopEnabled and playerSpeed are controlled by this screen (via useLessonPreferences).
 *    - The audio player is a dumb view that receives these as props and emits events.
 *
 * 2) Remount-per-slide audio:
 *    - SingleTrackPlayer is wrapped by LessonAudioPlayer and rendered with key={slideId}.
 *    - Changing slides changes the React key, which destroys the old player and mounts a new one.
 *    - This eliminates race conditions when swiping quickly (no stale loads to cancel).
 *
 * 3) Unidirectional data flow:
 *    - Player emits onNavigate('prev'|'next') and onFinish(); parent decides target slide.
 *    - Speed changes are reported via onSpeedChange(speed) back to the parent.
 *
 * 4) Programmatic scroll guard (encapsulated in useLessonNavigation):
 *    - When we advance slides due to audio finish or button navigation, a guard flag prevents
 *      the onSlideScroll handler from feeding the event back into navigation (no feedback loops).
 *
 * 5) Silent slides auto-advance (encapsulated in useLessonNavigation):
 *    - If a slide has no audio, the hook auto-advances after a short dwell to keep the flow.
 */

const LessonDetail = () => {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const { lessonId, title: routeTitle } = useLocalSearchParams<{
    lessonId?: string
    title?: string
  }>()

  const [lesson, setLesson] = useState<LessonDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Preferences must be available before navigation (for loop behavior)
  const { playerSpeed, setPlayerSpeed, loopEnabled, setLoopEnabled } = useLessonPreferences()

  // Compute modules early to feed navigation hook
  const modules = useMemo(() => (lesson ? extractModules(lesson) : []), [lesson])

  // Custom hook for caching (needed before computing slide audio)
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

  // Derive audio mapping and booleans from modules and cache
  const { hasAudio, slideAudio } = useSlideAudio(modules, cachedMedia)

  // Navigation hook encapsulates index, ref, width and handlers
  const {
    currentSlideIndex,
    flatListRef,
    screenWidth,
    onSlideScroll,
    handleNavigate,
    handleTrackFinish,
    resetToFirstSlide,
  } = useLessonNavigation({ totalSlides: modules.length, hasAudio, loopEnabled })
  const slideDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { colorScheme } = useThemeMode();

  const loadLesson = useCallback(async () => {
    if (!lessonId) {
      setError("Missing lesson ID")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
  const locale = i18n.language
      const data = await fetchLessonById(lessonId, locale)
      setLesson(data)
      setError(null)
    } catch (err) {
      console.error("Failed to load lesson", err)
      setError("Unable to load lesson. Try again later.")
    } finally {
      setLoading(false)
    }
  }, [lessonId, i18n])

  useEffect(() => {
    loadLesson()
  }, [loadLesson])

  useEffect(() => {
    return () => {
      // Clear any pending slide debounce on unmount
      if (slideDebounceTimer.current) {
        clearTimeout(slideDebounceTimer.current)
        slideDebounceTimer.current = null
      }
    }
  }, [])

  const modulesWithContent = modules

  // slideAudio computed by useSlideAudio
  const showAudioPlayer = modules.length > 0

  const renderModuleSlide = useCallback(
    ({ item, index }: { item: (typeof modules)[0]; index: number }) => {
      const imageUrl = resolveMediaUrl(item.image)
      return (
        <LessonSlide
          item={item}
          index={index}
          screenWidth={screenWidth}
          imageUrl={imageUrl}
          cachedMedia={cachedMedia}
          downloadProgress={downloadProgress}
        />
      )
    },
    [screenWidth, cachedMedia, downloadProgress]
  )

  // When player asks to navigate, we compute the target slide here.
  // Buttons are enabled in the player if "neighbor exists OR loop is on".
  // Parent is authoritative about loop and boundaries.

  // When track ends, also scroll to next slide
  // No-op: SingleTrackPlayer uses onFinish -> handleTrackFinish

  const headerTitle = lesson?.title || (typeof routeTitle === "string" && routeTitle) || (lessonId ? String(lessonId) : t("lesson.title"))

  // Learning session flow: landing -> active -> results
  const {
    mode,
    configuredSeconds,
    remainingSeconds,
    elapsedSeconds,
    startSession,
    // resetToLanding,
    restartSession,
    updateConfiguredSeconds,
  } = useLearningSession(lessonId, lesson?.title, { speed: playerSpeed, loop: loopEnabled })

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerBackButtonDisplayMode: "minimal",
          headerStyle: { backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff' },
          headerTitleStyle: { color: colorScheme === 'dark' ? '#fff' : '#18181b' },
          headerTintColor: colorScheme === 'dark' ? '#fff' : '#18181b',
          headerRight: () => (
            mode === "landing" ? undefined : <LessonHeaderControls
              loopEnabled={loopEnabled}
              cachingInProgress={cachingInProgress}
              cacheStatus={lessonCacheStatus}
              onToggleLoop={() => setLoopEnabled(!loopEnabled)}
              onOpenCacheMenu={() => setCacheMenuVisible(true)}
            />
          ),
        }}
      />
      {loading ? (
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colorScheme === 'dark' ? '#18181b' : undefined }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12, color: colorScheme === 'dark' ? '#d1d5db' : undefined }}>{t("lesson.loading")}</Text>
        </SafeAreaView>
      ) : error ? (
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, backgroundColor: colorScheme === 'dark' ? '#18181b' : undefined }}>
          <Text style={{ textAlign: "center", color: colorScheme === 'dark' ? '#ef4444' : "#b71c1c" }}>{error || t("lesson.error")}</Text>
        </SafeAreaView>
      ) : !lesson ? (
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, backgroundColor: colorScheme === 'dark' ? '#18181b' : undefined }}>
          <Text style={{ textAlign: "center", color: colorScheme === 'dark' ? '#d1d5db' : undefined }}>{t("lesson.notFound")}</Text>
        </SafeAreaView>
      ) : mode === "landing" ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#fff" }} edges={["bottom"]}>
          <LessonLandingCard
            summary={lesson.summary}
            sessionSeconds={configuredSeconds}
            speed={playerSpeed}
            onSessionSecondsChange={updateConfiguredSeconds}
            onSpeedChange={setPlayerSpeed}
            onStart={startSession}
          />
        </SafeAreaView>
      ) : mode === "results" ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#fff" }} edges={["bottom"]}>
          <LessonSessionResult
            elapsedSec={elapsedSeconds}
            plannedSec={configuredSeconds}
            onExit={() => router.back()}
            onRestart={() => {
              resetToFirstSlide()
              restartSession()
            }}
          />
        </SafeAreaView>
      ) : (
        <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#fff" }} edges={["bottom"]}>
          <View style={{ flex: 1 }}>
            <LessonCountdownTimer remaining={remainingSeconds} />
            {modulesWithContent.length === 0 ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
                <Text style={{ textAlign: "center", color: colorScheme === 'dark' ? '#d1d5db' : "#666" }}>{t("lesson.noModules")}</Text>
              </View>
            ) : (
              <>
                <FlatList
                  ref={flatListRef}
                  data={modulesWithContent}
                  keyExtractor={(item) => item.id}
                  renderItem={renderModuleSlide}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={onSlideScroll}
                  scrollEnabled={true}
                  getItemLayout={(_, index) => ({
                    length: screenWidth,
                    offset: screenWidth * index,
                    index,
                  })}
                />

                <PaginationDots
                  total={modulesWithContent.length}
                  currentIndex={currentSlideIndex}
                />
              </>
            )}
          </View>

      {mode === "active" && (showAudioPlayer || modules.length > 1) ? (
        <LessonAudioPlayer
          track={slideAudio[currentSlideIndex]?.audioUrl ? { id: slideAudio[currentSlideIndex].id, title: (slideAudio[currentSlideIndex].title ?? "") as string, audioUrl: slideAudio[currentSlideIndex].audioUrl as string } : null}
          playerSpeed={playerSpeed}
          loopEnabled={loopEnabled}
          hasPrev={currentSlideIndex > 0 || loopEnabled}
          hasNext={currentSlideIndex < modules.length - 1 || loopEnabled}
          onSpeedChange={setPlayerSpeed}
          onNavigate={handleNavigate}
          onFinish={handleTrackFinish}
        />
      ) : null}
      {/* Timer removed */}

      {/* Cache management modal */}
      <CacheMenuModal
        visible={cacheMenuVisible}
        onClose={() => setCacheMenuVisible(false)}
        cacheStatus={lessonCacheStatus}
        onRedownload={handleRedownload}
        onClear={handleClearCache}
      />
        </SafeAreaView>
      )}
    </>
  )
}

export default LessonDetail