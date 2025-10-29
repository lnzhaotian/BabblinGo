import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Dimensions, FlatList, Image, Modal, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, TextInput, View } from "react-native"
import * as Haptics from "expo-haptics"
import { SafeAreaView } from "react-native-safe-area-context"
import { MaterialIcons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"

import { extractModules, fetchLessonById, LessonDoc, MediaDoc, resolveMediaUrl } from "@/lib/payload"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useFocusEffect } from "@react-navigation/native"
import SingleTrackPlayer, { type PlaybackSpeed } from "@/components/SingleTrackPlayer"
import { useTranslation } from "react-i18next"
import { getOrDownloadFile } from "@/lib/cache-manager"

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

const extractParagraphs = (body: unknown): string[] => {
  if (!body) {
    return []
  }

  const root = (body as { root?: { children?: unknown[] } })?.root

  if (!root || !Array.isArray(root.children)) {
    return []
  }

  return root.children
    .map((node: any) => {
      const children = Array.isArray(node?.children) ? node.children : []
      return children
        .map((child: any) => (typeof child?.text === "string" ? child.text : ""))
        .join("")
        .trim()
    })
    .filter(Boolean)
}

const formatOrder = (order: number | null | undefined, index: number) => {
  const value = typeof order === "number" ? order : index + 1
  return String(value).padStart(2, "0")
}

const isMediaDoc = (value: MediaDoc | string | null | undefined): value is MediaDoc =>
  Boolean(value && typeof value === "object")

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

  // Session timer state
  const [timerModalVisible, setTimerModalVisible] = useState(false)
  const [timeUpModalVisible, setTimeUpModalVisible] = useState(false)
  // Default to 10 minutes
  const [selectedMinuteIndex, setSelectedMinuteIndex] = useState<number>(10)
  const [selectedSecondIndex, setSelectedSecondIndex] = useState<number>(0)
  const [resumeOnModalClose, setResumeOnModalClose] = useState<boolean>(false)
  const [playerResetCounter, setPlayerResetCounter] = useState<number>(0)
  // Track last emitted center indices for continuous haptics while scrolling
  const minuteHapticRef = useRef<number>(0)
  const secondHapticRef = useRef<number>(0)
  const [timerPaused, setTimerPaused] = useState<boolean>(false)
  const [timerActive, setTimerActive] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const sessionEndAtRef = useRef<number | null>(null)
  const [playerPlaySignal, setPlayerPlaySignal] = useState<number>(0)
  const [playerSuspended, setPlayerSuspended] = useState<boolean>(false)
  const sessionStartAtRef = useRef<number | null>(null)
  const plannedSecondsRef = useRef<number>(0)

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
  }, [])

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
        "lesson.playerSpeed",
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

  useEffect(() => {
    if (!prefsLoadedRef.current) return
    AsyncStorage.setItem("lesson.playerSpeed", String(playerSpeed)).catch(() => {})
  }, [playerSpeed])

  useEffect(() => {
    if (!prefsLoadedRef.current) return
    AsyncStorage.setItem("lesson.loopEnabled", String(loopEnabled)).catch(() => {})
  }, [loopEnabled])


  const modulesWithContent = modules
  // Save a session record to AsyncStorage
  const saveLearningSession = useCallback(async (record: { lessonId: string; lessonTitle: string; startedAt: number; endedAt: number; plannedSeconds: number; speed: number }) => {
    try {
      const key = "learning.sessions"
      const raw = await AsyncStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      arr.push({ id: Math.random().toString(36).slice(2), ...record })
      await AsyncStorage.setItem(key, JSON.stringify(arr))
    } catch {}
  }, [])

  // Format countdown for header (MM:SS)
  const formatCountdown = (total: number) => {
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  // Timer tick
  useEffect(() => {
    if (!timerActive || timerPaused || !sessionEndAtRef.current) return
    const tick = () => {
      const now = Date.now()
      const remainMs = sessionEndAtRef.current! - now
      const remainSec = Math.max(0, Math.ceil(remainMs / 1000))
      setRemainingSeconds(remainSec)
      if (remainSec <= 0) {
        // Time's up: stop audio and slides, show modal, record session
        setTimerActive(false)
        setPlayerSuspended(true)
        setTimeUpModalVisible(true)
        // Save session record
        const startedAt = sessionStartAtRef.current ?? now
        saveLearningSession({
          lessonId: lesson?.id ?? String(lessonId ?? ""),
          lessonTitle: lesson?.title ?? String(routeTitle ?? "Lesson"),
          startedAt,
          endedAt: now,
          plannedSeconds: plannedSecondsRef.current,
          speed: playerSpeed,
        }).catch(() => {})
      }
    }
    const iv = setInterval(tick, 1000)
    tick()
    return () => clearInterval(iv)
  }, [timerActive, timerPaused, lesson?.id, lesson?.title, lessonId, routeTitle, playerSpeed, saveLearningSession])

  const pauseTimer = useCallback(() => {
    if (!timerActive || timerPaused) return
    // Freeze remaining seconds
    if (sessionEndAtRef.current) {
      const now = Date.now()
      const remainMs = sessionEndAtRef.current - now
      const remainSec = Math.max(0, Math.ceil(remainMs / 1000))
      setRemainingSeconds(remainSec)
    }
    sessionEndAtRef.current = null
    setTimerPaused(true)
  }, [timerActive, timerPaused])

  const resumeTimer = useCallback(() => {
    if (!timerActive || !timerPaused) return
    const now = Date.now()
    sessionEndAtRef.current = now + remainingSeconds * 1000
    setTimerPaused(false)
  }, [timerActive, timerPaused, remainingSeconds])

  

  const startTimer = useCallback(() => {
    // Build duration from wheels (minutes + seconds)
    const minutes = Math.max(0, Math.floor(Number(selectedMinuteIndex) || 0))
    const seconds = Math.max(0, Math.floor(Number(selectedSecondIndex) || 0))
    const durationSecRaw = minutes * 60 + seconds
    const durationSec = Math.max(1, durationSecRaw) // enforce at least 1 second
    // Jump to the first slide for a full learning session
    if (currentSlideIndex !== 0) {
      programmaticScrollRef.current = true
      flatListRef.current?.scrollToIndex({ index: 0, animated: true })
      setCurrentSlideIndex(0)
    }
    const now = Date.now()
    sessionStartAtRef.current = now
    sessionEndAtRef.current = now + durationSec * 1000
    plannedSecondsRef.current = durationSec
    setRemainingSeconds(durationSec)
    // Turn on loop and kick playback
    setLoopEnabled(true)
    setPlayerSuspended(false)
    setPlayerPlaySignal((x) => x + 1)
    setTimerActive(true)
    setTimerModalVisible(false)
  }, [selectedMinuteIndex, selectedSecondIndex, currentSlideIndex])

  const cancelTimer = useCallback(() => {
    setTimerActive(false)
    sessionEndAtRef.current = null
    setRemainingSeconds(0)
    setPlayerSuspended(true)
  }, [])

  
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
    const displayOrder = formatOrder(item.order, index)
    const paragraphs = extractParagraphs(item.body)
    const imageUrl = resolveMediaUrl(item.image)
    const imageAlt = isMediaDoc(item.image) ? item.image?.filename ?? item.title : item.title

    // Use cached image if available, otherwise use remote URL
    const displayImageUrl = imageUrl && cachedMedia[imageUrl] ? cachedMedia[imageUrl] : imageUrl
    const isDownloading = imageUrl && downloadProgress[imageUrl] !== undefined && downloadProgress[imageUrl] < 1

    return (
      <View style={{ width: screenWidth, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" }}>
        <View style={{ gap: 12, width: "100%", maxWidth: 600 }}>
          {displayImageUrl ? (
            <View style={{ position: 'relative' }}>
              <Image
                source={{ uri: displayImageUrl }}
                accessibilityLabel={imageAlt || `Module ${displayOrder}`}
                style={{ width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: "#f5f5f5" }}
                resizeMode="cover"
              />
              {/* Show downloading indicator */}
              {isDownloading && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                    {t("lesson.downloading") || "Downloading..."}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {paragraphs.length > 0 ? (
            <View style={{ gap: 12 }}>
              {paragraphs.map((paragraph, paragraphIndex) => (
                <Text key={paragraphIndex} style={{ fontSize: 24, lineHeight: 30, fontWeight: "700", textAlign: "center", color: "#333" }}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    )
  }, [screenWidth, cachedMedia, downloadProgress, t])

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

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>{t("lesson.loading")}</Text>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
        <Text style={{ textAlign: "center", color: "#b71c1c" }}>{error || t("lesson.error")}</Text>
      </SafeAreaView>
    )
  }

  if (!lesson) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
        <Text style={{ textAlign: "center" }}>{t("lesson.notFound")}</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} edges={["top", "bottom"]}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: "#eee",
          }}
        >
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Back"
            style={{ padding: 4, marginRight: 8 }}
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={26} color="#007aff" />
          </Pressable>
          <Text style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700" }} numberOfLines={1}>
            {lesson.title || routeTitle || "Lesson"}
          </Text>
          {/* Cache indicator */}
          {cachingInProgress && (
            <View style={{ marginLeft: 8 }}>
              <ActivityIndicator size="small" color="#007aff" />
            </View>
          )}
          {/* Timer button + countdown */}
          <Pressable
            onPress={() => {
              // Pause playback and (if running) pause the timer while user sets timer
              setPlayerSuspended(true)
              setResumeOnModalClose(true)
              if (timerActive && !timerPaused) {
                pauseTimer()
              }
              setTimerModalVisible(true)
            }}
            accessibilityLabel="Set session timer"
            hitSlop={8}
            style={{ padding: 4, marginLeft: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <MaterialIcons name="timer" size={22} color={timerActive ? "#16a34a" : "#9ca3af"} />
            {timerActive ? (
              <Text style={{ fontSize: 14, color: "#16a34a", fontWeight: "700" }}>{formatCountdown(remainingSeconds)}</Text>
            ) : null}
          </Pressable>
          <Pressable
            onPress={() => setLoopEnabled(!loopEnabled)}
            accessibilityLabel="Toggle loop"
            hitSlop={8}
            style={{ padding: 4, marginLeft: 8 }}
          >
            <MaterialIcons name="repeat" size={22} color={loopEnabled ? "#6366f1" : "#9ca3af"} />
          </Pressable>
        </View>

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

              <View style={{ flexDirection: "row", justifyContent: "center", paddingVertical: 12, gap: 8 }}>
                {modulesWithContent.map((_, index) => (
                  <View
                    key={index}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: currentSlideIndex === index ? "#007aff" : "#d1d1d6",
                    }}
                  />
                ))}
              </View>
            </>
          )}
        </View>
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
                  key={`${slideId}:${playerResetCounter}`}
                  track={{ id: trk.id, title: trk.title, audioUrl }}
                  autoPlay
                  speed={playerSpeed}
                  loop={loopEnabled}
                  hasPrev={currentSlideIndex > 0 || loopEnabled}
                  hasNext={currentSlideIndex < modules.length - 1 || loopEnabled}
                  debug={false}
                  onSpeedChange={setPlayerSpeed}
                  onNavigate={handleNavigate}
                  onFinish={handleTrackFinish}
                  suspend={playerSuspended}
                  playSignal={playerPlaySignal}
                />
              )
            })()
          ) : null}
        </View>
      ) : null}
      {/* Timer setup modal */}
      <Modal
        visible={timerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          // Close without starting: resume playback if requested
          setTimerModalVisible(false)
          if (timerActive && timerPaused) {
            // Resume the timer and playback
            resumeTimer()
            setPlayerSuspended(false)
            setPlayerPlaySignal((x) => x + 1)
          } else if (resumeOnModalClose && !timerActive) {
            // No active timer; simply resume playback
            setPlayerSuspended(false)
            setPlayerPlaySignal((x) => x + 1)
          }
          setResumeOnModalClose(false)
        }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", textAlign: "center" }}>{t("timer.set")}</Text>
            {/* Inputs for quick manual edit */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <View style={{ alignItems: "center" }}>
                <TextInput
                  value={String(selectedMinuteIndex)}
                  onChangeText={(txt) => {
                    const n = Math.min(59, Math.max(0, Math.floor(Number(txt) || 0)))
                    setSelectedMinuteIndex(n)
                  }}
                  keyboardType="number-pad"
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 80, textAlign: "center" }}
                  placeholder="MM"
                />
                <Text style={{ color: "#6b7280", marginTop: 4 }}>{t("timer.minutes")}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "700" }}>:</Text>
              <View style={{ alignItems: "center" }}>
                <TextInput
                  value={String(selectedSecondIndex).padStart(2, "0")}
                  onChangeText={(txt) => {
                    const n = Math.min(59, Math.max(0, Math.floor(Number(txt) || 0)))
                    setSelectedSecondIndex(n)
                  }}
                  keyboardType="number-pad"
                  style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 80, textAlign: "center" }}
                  placeholder="SS"
                />
                <Text style={{ color: "#6b7280", marginTop: 4 }}>{t("timer.seconds")}</Text>
              </View>
            </View>

            {/* Wheels for swipe selection (centered and looping) */}
            {(() => {
              const ITEM_HEIGHT = 36
              const VISIBLE_ITEMS = 5
              const PAD = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT
              const CYCLES = 50 // ample to avoid edges
              const base = Math.floor(CYCLES / 2) * 60
              const fmt = (n: number) => String(n).padStart(2, "0")
              const minutesLoop = Array.from({ length: CYCLES * 60 }, (_, idx) => fmt(idx % 60))
              const secondsLoop = Array.from({ length: CYCLES * 60 }, (_, idx) => fmt(idx % 60))
              return (
                <View style={{ flexDirection: "row", justifyContent: "center", gap: 16, marginTop: 8 }}>
                  {/* Minutes wheel */}
                  <View style={{ alignItems: "center" }}>
                    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width: 80, overflow: "hidden" }}>
                      {/* Center highlight */}
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: ITEM_HEIGHT * (VISIBLE_ITEMS / 2) - ITEM_HEIGHT / 2,
                          height: ITEM_HEIGHT,
                          backgroundColor: "#eef2ff",
                          opacity: 0.6,
                          borderRadius: 8,
                        }}
                      />
                      <FlatList
                        data={minutesLoop}
                        keyExtractor={(_, i) => `m-${i}`}
                        initialScrollIndex={base + selectedMinuteIndex}
                        getItemLayout={(_, idx) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * idx, index: idx })}
                        showsVerticalScrollIndicator={false}
                        snapToInterval={ITEM_HEIGHT}
                        decelerationRate="fast"
                        contentContainerStyle={{ paddingVertical: PAD }}
                        scrollEventThrottle={16}
                        onScroll={(e) => {
                          const y = e.nativeEvent.contentOffset.y
                          const idx = Math.round(y / ITEM_HEIGHT)
                          const val = ((idx % 60) + 60) % 60
                          if (val !== minuteHapticRef.current) {
                            minuteHapticRef.current = val
                            setSelectedMinuteIndex(val)
                            Haptics.selectionAsync().catch(() => {})
                          }
                        }}
                        onMomentumScrollEnd={(e) => {
                          const y = e.nativeEvent.contentOffset.y
                          const idx = Math.round(y / ITEM_HEIGHT)
                          const val = ((idx % 60) + 60) % 60
                          setSelectedMinuteIndex(val)
                          Haptics.selectionAsync().catch(() => {})
                        }}
                        renderItem={({ item, index }) => (
                          <View style={{ height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" }}>
                            <Text style={{ fontSize: 18, fontWeight: (index % 60) === selectedMinuteIndex ? "700" : "400", color: (index % 60) === selectedMinuteIndex ? "#111827" : "#9ca3af" }}>
                              {item}
                            </Text>
                          </View>
                        )}
                      />
                    </View>
                  </View>
                  <View style={{ justifyContent: "center" }}>
                    <Text style={{ fontSize: 18, fontWeight: "700" }}>:</Text>
                  </View>
                  {/* Seconds wheel */}
                  <View style={{ alignItems: "center" }}>
                    <View style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS, width: 80, overflow: "hidden" }}>
                      {/* Center highlight */}
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: ITEM_HEIGHT * (VISIBLE_ITEMS / 2) - ITEM_HEIGHT / 2,
                          height: ITEM_HEIGHT,
                          backgroundColor: "#eef2ff",
                          opacity: 0.6,
                          borderRadius: 8,
                        }}
                      />
                      <FlatList
                        data={secondsLoop}
                        keyExtractor={(_, i) => `s-${i}`}
                        initialScrollIndex={base + selectedSecondIndex}
                        getItemLayout={(_, idx) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * idx, index: idx })}
                        showsVerticalScrollIndicator={false}
                        snapToInterval={ITEM_HEIGHT}
                        decelerationRate="fast"
                        contentContainerStyle={{ paddingVertical: PAD }}
                        scrollEventThrottle={16}
                        onScroll={(e) => {
                          const y = e.nativeEvent.contentOffset.y
                          const idx = Math.round(y / ITEM_HEIGHT)
                          const val = ((idx % 60) + 60) % 60
                          if (val !== secondHapticRef.current) {
                            secondHapticRef.current = val
                            setSelectedSecondIndex(val)
                            Haptics.selectionAsync().catch(() => {})
                          }
                        }}
                        onMomentumScrollEnd={(e) => {
                          const y = e.nativeEvent.contentOffset.y
                          const idx = Math.round(y / ITEM_HEIGHT)
                          const val = ((idx % 60) + 60) % 60
                          setSelectedSecondIndex(val)
                          Haptics.selectionAsync().catch(() => {})
                        }}
                        renderItem={({ item, index }) => (
                          <View style={{ height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" }}>
                            <Text style={{ fontSize: 18, fontWeight: (index % 60) === selectedSecondIndex ? "700" : "400", color: (index % 60) === selectedSecondIndex ? "#111827" : "#9ca3af" }}>
                              {item}
                            </Text>
                          </View>
                        )}
                      />
                    </View>
                  </View>
                </View>
              )
            })()}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => {
                  // Close without starting: resume playback (and timer if paused)
                  setTimerModalVisible(false)
                  if (timerActive && timerPaused) {
                    resumeTimer()
                    setPlayerSuspended(false)
                    setPlayerPlaySignal((x) => x + 1)
                  } else if (resumeOnModalClose && !timerActive) {
                    setPlayerSuspended(false)
                    setPlayerPlaySignal((x) => x + 1)
                  }
                  setResumeOnModalClose(false)
                }}
                style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#e5e7eb" }}
              >
                <Text style={{ fontWeight: "600", color: "#374151" }}>{t("timer.close")}</Text>
              </Pressable>
              {timerActive ? (
                <Pressable onPress={cancelTimer} style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#ef4444" }}>
                  <Text style={{ fontWeight: "700", color: "#fff" }}>{t("timer.cancel")}</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  // Starting a session: reset player to start and play
                  setResumeOnModalClose(false)
                  setTimerPaused(false)
                  setPlayerResetCounter((c) => c + 1)
                  startTimer()
                }}
                style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#6366f1" }}
              >
                <Text style={{ fontWeight: "700", color: "#fff" }}>{timerActive ? t("timer.restart") : t("timer.start")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Time up modal */}
      <Modal visible={timeUpModalVisible} transparent animationType="fade" onRequestClose={() => setTimeUpModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center", padding: 24 }}>
          <View style={{ width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 12, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", textAlign: "center" }}>{t("timer.timeUp")}</Text>
            <Text style={{ textAlign: "center", color: "#6b7280" }}>{t("timer.timeUpMessage")}</Text>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 8 }}>
              <Pressable
                onPress={() => {
                  setTimeUpModalVisible(false)
                  setTimerModalVisible(true)
                }}
                style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#6366f1" }}
              >
                <Text style={{ fontWeight: "700", color: "#fff" }}>{t("timer.setNew")}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setTimeUpModalVisible(false)
                  // Return to previous screen without duplicating routes
                  router.back()
                }}
                style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#ef4444" }}
              >
                <Text style={{ fontWeight: "700", color: "#fff" }}>{t("timer.endSession")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

export default LessonDetail

