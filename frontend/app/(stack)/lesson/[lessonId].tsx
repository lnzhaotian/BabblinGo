import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, Dimensions, FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Stack, useLocalSearchParams } from "expo-router"
import { MaterialIcons } from "@expo/vector-icons"

import { extractModules, fetchLessonById, LessonDoc, resolveMediaUrl } from "@/lib/payload"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect } from "@react-navigation/native"
import SingleTrackPlayer, { type PlaybackSpeed } from "@/components/SingleTrackPlayer"
import { useTranslation } from "react-i18next"
import { getOrDownloadFile, getLessonCacheStatus, clearLessonCache, redownloadLessonMedia, LessonCacheStatus } from "@/lib/cache-manager"

import { LessonSlide } from "@/components/LessonSlide"
// Timer-related UI removed
import { CacheMenuModal } from "@/components/CacheMenuModal"
import { PaginationDots } from "@/components/PaginationDots"

/**
 * Lesson detail screen – Audio + Slides architecture
 *
 * Key design choices (keep these in sync if you refactor):
 * 1) Parent-controlled state (single source of truth):
 *    - loopEnabled and playerSpeed live here in the lesson screen.
 *    - The audio player is a dumb view that receives these as props and emits events.
 *
 * 2) Remount-per-slide audio:
 *    - For each slide we render a SingleTrackPlayer keyed by the slide id.
 *    - Changing slides changes the React key, which destroys the old player and mounts a new one.
 *    - This eliminates race conditions when swiping quickly (no stale loads to cancel).
 *
 * 3) Unidirectional data flow:
 *    - Player emits onNavigate('prev'|'next') and onFinish(); parent decides target slide.
 *    - Speed changes are reported via onSpeedChange(speed) back to the parent.
 *
 * 4) Programmatic scroll guard:
 *    - When we advance slides due to audio finish or button navigation, we set a flag
 *      (programmaticScrollRef). The onSlideScroll handler clears it and avoids feeding
 *      the event back into navigation, preventing feedback loops.
 *
 * 5) Silent slides auto-advance:
 *    - If a slide has no audio, we automatically advance after a small dwell time
 *      to keep the flow consistent.
 */

const LessonDetail = () => {
  const { t, i18n } = useTranslation()
  const { lessonId, title: routeTitle } = useLocalSearchParams<{
    lessonId?: string
    title?: string
  }>()

  const [lesson, setLesson] = useState<LessonDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [playerSpeed, setPlayerSpeed] = useState<PlaybackSpeed>(1.0 as PlaybackSpeed)
  const [loopEnabled, setLoopEnabled] = useState<boolean>(true)
  const flatListRef = useRef<FlatList>(null)
  const { width: screenWidth } = Dimensions.get("window")
  const programmaticScrollRef = useRef(false)
  const slideDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Prevent writing default prefs over saved ones before initial load completes
  const prefsLoadedRef = useRef(false)

  // Cache state
  const [cachedMedia, setCachedMedia] = useState<Record<string, string>>({}) // URL -> local path
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({}) // URL -> progress (0-1)
  const [cachingInProgress, setCachingInProgress] = useState(false)
  const [lessonCacheStatus, setLessonCacheStatus] = useState<LessonCacheStatus>('none')
  const [cacheMenuVisible, setCacheMenuVisible] = useState(false)

  // Timer and session logging removed

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

  // Cache media files (images and audio) for offline access
  const cacheMediaFiles = useCallback(async (lessonData: LessonDoc) => {
    if (!lessonData.updatedAt) return

    setCachingInProgress(true)
    const version = lessonData.updatedAt
    const modulesList = extractModules(lessonData)
    const cached: Record<string, string> = {}

    // Collect all media URLs
    const mediaUrls: { url: string; type: 'image' | 'audio' }[] = []
    
    for (const module of modulesList) {
      const imageUrl = resolveMediaUrl(module.image)
      const audioUrl = resolveMediaUrl(module.audio)
      
      if (imageUrl) mediaUrls.push({ url: imageUrl, type: 'image' })
      if (audioUrl) mediaUrls.push({ url: audioUrl, type: 'audio' })
    }

    // Download all files in parallel
    await Promise.all(
      mediaUrls.map(async ({ url }) => {
        try {
          const localPath = await getOrDownloadFile(
            url,
            version,
            false, // Don't force download if cached
            (progress) => {
              setDownloadProgress((prev) => ({ ...prev, [url]: progress }))
            }
          )
          cached[url] = localPath
          // Clear progress indicator once complete
          setDownloadProgress((prev) => {
            const next = { ...prev }
            delete next[url]
            return next
          })
        } catch (error) {
          console.error(`Failed to cache ${url}:`, error)
        }
      })
    )

    setCachedMedia(cached)
    setCachingInProgress(false)

    // Update cache status
    if (mediaUrls.length > 0) {
      try {
        const status = await getLessonCacheStatus(
          mediaUrls.map(m => m.url),
          version
        );
        setLessonCacheStatus(status.status);
      } catch (error) {
        console.error('Failed to get cache status:', error);
      }
    }
  }, [])

  // Handle clearing cache for this lesson
  const handleClearCache = useCallback(async () => {
    if (!lesson || !lesson.updatedAt) return;

    Alert.alert(
      t("lesson.cache.clearTitle") || "Clear Cache?",
      t("lesson.cache.clearMessage") || "This will delete all cached media for this lesson.",
      [
        { text: t("common.cancel") || "Cancel", style: "cancel" },
        {
          text: t("common.clear") || "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const modulesList = extractModules(lesson);
              const mediaUrls: string[] = [];

              for (const module of modulesList) {
                const imageUrl = resolveMediaUrl(module.image);
                const audioUrl = resolveMediaUrl(module.audio);
                if (imageUrl) mediaUrls.push(imageUrl);
                if (audioUrl) mediaUrls.push(audioUrl);
              }

              await clearLessonCache(mediaUrls);
              setCachedMedia({});
              setLessonCacheStatus('none');
              setCacheMenuVisible(false);
              Alert.alert(
                t("lesson.cache.cleared") || "Cache Cleared",
                t("lesson.cache.clearedMessage") || "Media files have been removed."
              );
            } catch (error) {
              console.error('Failed to clear cache:', error);
              Alert.alert(
                t("common.error") || "Error",
                t("lesson.cache.clearError") || "Failed to clear cache."
              );
            }
          },
        },
      ]
    );
  }, [lesson, t]);

  // Handle re-downloading all media
  const handleRedownload = useCallback(async () => {
    if (!lesson || !lesson.updatedAt) return;

    Alert.alert(
      t("lesson.cache.redownloadTitle") || "Re-download Media?",
      t("lesson.cache.redownloadMessage") || "This will download fresh copies of all media files.",
      [
        { text: t("common.cancel") || "Cancel", style: "cancel" },
        {
          text: t("lesson.cache.redownload") || "Re-download",
          onPress: async () => {
            try {
              setCacheMenuVisible(false);
              setCachingInProgress(true);
              setLessonCacheStatus('downloading');

              const modulesList = extractModules(lesson);
              const mediaUrls: string[] = [];

              for (const module of modulesList) {
                const imageUrl = resolveMediaUrl(module.image);
                const audioUrl = resolveMediaUrl(module.audio);
                if (imageUrl) mediaUrls.push(imageUrl);
                if (audioUrl) mediaUrls.push(audioUrl);
              }

              await redownloadLessonMedia(
                mediaUrls,
                lesson.updatedAt!,
                (url, progress) => {
                  setDownloadProgress((prev) => ({ ...prev, [url]: progress }));
                }
              );

              // Reload cached media
              await cacheMediaFiles(lesson);
            } catch (error) {
              console.error('Failed to redownload:', error);
              Alert.alert(
                t("common.error") || "Error",
                t("lesson.cache.redownloadError") || "Failed to re-download media."
              );
            } finally {
              setCachingInProgress(false);
            }
          },
        },
      ]
    );
  }, [lesson, t, cacheMediaFiles]);

  useEffect(() => {
    loadLesson()
  }, [loadLesson])

  // Cache media after lesson loads
  useEffect(() => {
    if (lesson) {
      cacheMediaFiles(lesson)
    }
  }, [lesson, cacheMediaFiles])

  useEffect(() => {
    return () => {
      // Clear any pending slide debounce on unmount
      if (slideDebounceTimer.current) {
        clearTimeout(slideDebounceTimer.current)
        slideDebounceTimer.current = null
      }
    }
  }, [])

  const modules = useMemo(() => (lesson ? extractModules(lesson) : []), [lesson])
  // Persist user preferences for loop and speed so they survive app restarts.
  // Load on mount and whenever the screen regains focus (e.g., user navigates back into it).
  const loadPrefs = useCallback(async () => {
    try {
      const [[, savedSpeed], [, savedLoop]] = await AsyncStorage.multiGet([
        "learning.playbackSpeed",
        "lesson.loopEnabled",
      ])
      
      if (savedSpeed) {
        const n = Number(savedSpeed)
        if (!Number.isNaN(n)) setPlayerSpeed(n as PlaybackSpeed)
      }
      if (savedLoop != null) {
        // Accept "true"/"false" string
        setLoopEnabled(savedLoop === "true")
      }
      prefsLoadedRef.current = true
    } catch {
      // Non-fatal: fall back to defaults
      prefsLoadedRef.current = true
    }
  }, [])

  useEffect(() => {
    loadPrefs()
  }, [loadPrefs])

  useFocusEffect(
    useCallback(() => {
      // Reload preferences whenever the screen gains focus
      loadPrefs()
      return () => {}
    }, [loadPrefs])
  )

  // Don't persist speed changes during a lesson - they're session-only
  // Speed is loaded from settings on mount but not saved back
  
  useEffect(() => {
    if (!prefsLoadedRef.current) return
    AsyncStorage.setItem("lesson.loopEnabled", String(loopEnabled)).catch(() => {})
  }, [loopEnabled])


  const modulesWithContent = modules
  // Timer logic removed

  
  // Auto-advance behavior for slides without audio
  // If a slide has no associated audio track, we'll advance to the next slide
  // after a short dwell time to keep the slideshow flowing.
  const SILENT_SLIDE_DWELL_MS = 2500
  
  // Pre-resolve audio per slide for quick lookup
  const slideAudio = useMemo(() => modules.map(m => {
    const audioUrl = resolveMediaUrl(m.audio)
    // Use cached audio if available
    const displayAudioUrl = audioUrl && cachedMedia[audioUrl] ? cachedMedia[audioUrl] : audioUrl
    return { id: m.id, title: m.title, audioUrl: displayAudioUrl }
  }), [modules, cachedMedia])
  const showAudioPlayer = modules.length > 0

  // Keep the slide index in sync with user scrolls, but avoid triggering
  // another navigation when the scroll originated from our own programmatic
  // action (e.g., auto-advance on finish). The flag is toggled around
  // scrollToIndex calls.
  const onSlideScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / screenWidth)
    setCurrentSlideIndex(index)
    if (programmaticScrollRef.current) {
      // Reset the flag and do not sync to audio to avoid feedback loops
      programmaticScrollRef.current = false
      return
    }
    // No direct player sync; remounting by key will take effect
  }, [screenWidth])

const renderModuleSlide = useCallback(({ item, index }: { item: typeof modules[0]; index: number }) => {
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
}, [screenWidth, cachedMedia, downloadProgress])

  // When player asks to navigate, we compute the target slide here.
  // Buttons are enabled in the player if "neighbor exists OR loop is on".
  // Parent is authoritative about loop and boundaries.
  const handleNavigate = useCallback((action: 'prev' | 'next') => {
    const lastIndex = modules.length - 1
    let target = currentSlideIndex
    if (action === 'prev') {
      if (currentSlideIndex > 0) target = currentSlideIndex - 1
      else if (loopEnabled && lastIndex >= 0) target = lastIndex
    } else {
      if (currentSlideIndex < lastIndex) target = currentSlideIndex + 1
      else if (loopEnabled && lastIndex >= 0) target = 0
    }
    if (target !== currentSlideIndex) {
      programmaticScrollRef.current = true
      flatListRef.current?.scrollToIndex({ index: target, animated: true })
      setCurrentSlideIndex(target)
    }
  }, [currentSlideIndex, modules.length, loopEnabled])

  // When the current track finishes, advance to the next slide (or wrap if loop).
  // If loop is off and we're on the last slide, do nothing—player remains mounted
  // and the user can press Play to replay (player seeks to 0 on play click).
  const handleTrackFinish = useCallback(() => {
    const lastIndex = modules.length - 1
    let next = currentSlideIndex
    if (currentSlideIndex < lastIndex) next = currentSlideIndex + 1
    else if (loopEnabled && lastIndex >= 0) next = 0
    else return
    programmaticScrollRef.current = true
    flatListRef.current?.scrollToIndex({ index: next, animated: true })
    setCurrentSlideIndex(next)
  }, [currentSlideIndex, modules.length, loopEnabled])

  // Auto-advance slides that have no audio after a short dwell
  useEffect(() => {
    if (modulesWithContent.length === 0) return
    // Build a quick set of module indices that have audio
  const audioModuleSet = new Set<number>(modules.map((_, idx) => (slideAudio[idx]?.audioUrl ? idx : -1)).filter((i) => i >= 0))
    // If current slide has audio, do nothing—audio player will drive advancement
    if (audioModuleSet.has(currentSlideIndex)) return

    // Otherwise, schedule a timed advance to the next slide
    const nextIndex = currentSlideIndex + 1
    if (nextIndex >= modulesWithContent.length) return

    const timer = setTimeout(() => {
      // Scroll to next slide; onSlideScroll will update state
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true })
      setCurrentSlideIndex(nextIndex)
    }, SILENT_SLIDE_DWELL_MS)

    return () => clearTimeout(timer)
  }, [currentSlideIndex, modulesWithContent.length, slideAudio, modules])

  // When track ends, also scroll to next slide
  // No-op: SingleTrackPlayer uses onFinish -> handleTrackFinish

  const headerTitle = lesson?.title || (typeof routeTitle === "string" && routeTitle) || (lessonId ? String(lessonId) : t("lesson.title"))

  return (
    <>
      <Stack.Screen
        options={{
          title: headerTitle,
          headerBackButtonDisplayMode: "minimal",
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* Optional caching spinner (overlay to avoid layout shift) */}
              {cachingInProgress ? (
                <View style={{ position: "absolute", right: 52, top: -6 }} pointerEvents="none">
                  <ActivityIndicator size="small" color="#007aff" />
                </View>
              ) : null}
              <Pressable
                onPress={() => setLoopEnabled(!loopEnabled)}
                accessibilityLabel="Toggle loop"
                hitSlop={8}
                style={{ padding: 4, marginLeft: 8 }}
              >
                <MaterialIcons name="repeat" size={22} color={loopEnabled ? "#6366f1" : "#9ca3af"} />
              </Pressable>
              <Pressable
                onPress={() => setCacheMenuVisible(true)}
                accessibilityLabel="Cache options"
                hitSlop={8}
                style={{ padding: 4, marginLeft: 8 }}
              >
                <MaterialIcons
                  name={
                    lessonCacheStatus === "full"
                      ? "cloud-done"
                      : lessonCacheStatus === "partial"
                        ? "cloud-download"
                        : "cloud-queue"
                  }
                  size={22}
                  color={
                    lessonCacheStatus === "full"
                      ? "#10b981"
                      : lessonCacheStatus === "partial"
                        ? "#f59e0b"
                        : "#9ca3af"
                  }
                />
              </Pressable>
            </View>
          ),
        }}
      />
      {loading ? (
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12 }}>{t("lesson.loading")}</Text>
        </SafeAreaView>
      ) : error ? (
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
          <Text style={{ textAlign: "center", color: "#b71c1c" }}>{error || t("lesson.error")}</Text>
        </SafeAreaView>
      ) : !lesson ? (
        <SafeAreaView edges={["bottom"]} style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
          <Text style={{ textAlign: "center" }}>{t("lesson.notFound")}</Text>
        </SafeAreaView>
      ) : (
        <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["bottom"]}>
          <View style={{ flex: 1 }}>
            {modulesWithContent.length === 0 ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
                <Text style={{ textAlign: "center", color: "#666" }}>{t("lesson.noModules")}</Text>
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

      {showAudioPlayer || modules.length > 1 ? (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: "#eee",
            backgroundColor: "#fff",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 4,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 16,
          }}
        >
          {/* Single-track player per slide
              - The key={slideId} forces a fresh mount when slide changes.
              - We pass parent-controlled "speed" and "loop".
              - onSpeedChange bubbles user speed choice up for persistence across slides.
          */}
          {slideAudio[currentSlideIndex]?.audioUrl ? (
            (() => {
              const trk = slideAudio[currentSlideIndex]
              const slideId = trk.id
              const audioUrl = trk.audioUrl
              if (!audioUrl) return null
              return (
                <SingleTrackPlayer
                  key={slideId}
                  track={{ id: trk.id, title: (trk.title ?? "") as string, audioUrl }}
                  autoPlay
                  speed={playerSpeed}
                  loop={loopEnabled}
                  hasPrev={currentSlideIndex > 0 || loopEnabled}
                  hasNext={currentSlideIndex < modules.length - 1 || loopEnabled}
                  debug={false}
                  onSpeedChange={setPlayerSpeed}
                  onNavigate={handleNavigate}
                  onFinish={handleTrackFinish}
                />
              )
            })()
          ) : null}
        </View>
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


