import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Dimensions, FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { MaterialIcons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"

import { extractModules, fetchLessonById, LessonDoc, MediaDoc, resolveMediaUrl } from "@/lib/payload"
import SingleTrackPlayer from "@/components/SingleTrackPlayer"

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
  const router = useRouter()
  const { lessonId, title: routeTitle } = useLocalSearchParams<{
    lessonId?: string
    title?: string
  }>()

  const [lesson, setLesson] = useState<LessonDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const [diagnostics, setDiagnostics] = useState(false)
  const flatListRef = useRef<FlatList>(null)
  const { width: screenWidth } = Dimensions.get("window")
  const programmaticScrollRef = useRef(false)
  const slideDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadLesson = useCallback(async () => {
    if (!lessonId) {
      setError("Missing lesson ID")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await fetchLessonById(lessonId)
      setLesson(data)
      setError(null)
    } catch (err) {
      console.error("Failed to load lesson", err)
      setError("Unable to load lesson. Try again later.")
    } finally {
      setLoading(false)
    }
  }, [lessonId])

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

  const modules = useMemo(() => (lesson ? extractModules(lesson) : []), [lesson])

  const modulesWithContent = modules
  
  // Auto-advance behavior for slides without audio
  // If a slide has no associated audio track, we'll advance to the next slide
  // after a short dwell time to keep the slideshow flowing.
  const SILENT_SLIDE_DWELL_MS = 2500
  
  // Pre-resolve audio per slide for quick lookup
  const slideAudio = useMemo(() => modules.map(m => ({ id: m.id, title: m.title, audioUrl: resolveMediaUrl(m.audio) })), [modules])
  const showAudioPlayer = modules.length > 0

  const onSlideScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / screenWidth)
    setCurrentSlideIndex(index)
    if (diagnostics) console.log(`[LessonDetail] onSlideScroll: offsetX=${offsetX.toFixed(1)}, index=${index}`)
    if (programmaticScrollRef.current) {
      // Reset the flag and do not sync to audio to avoid feedback loops
      programmaticScrollRef.current = false
      return
    }
    // No direct player sync; remounting by key will take effect
  }, [screenWidth, diagnostics])

  const renderModuleSlide = useCallback(({ item, index }: { item: typeof modules[0]; index: number }) => {
    const displayOrder = formatOrder(item.order, index)
    const paragraphs = extractParagraphs(item.body)
    const imageUrl = resolveMediaUrl(item.image)
    const imageAlt = isMediaDoc(item.image) ? item.image?.filename ?? item.title : item.title

    return (
      <View style={{ width: screenWidth, paddingHorizontal: 16, justifyContent: "center", alignItems: "center" }}>
        <View style={{ gap: 12, width: "100%", maxWidth: 600 }}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              accessibilityLabel={imageAlt || `Module ${displayOrder}`}
              style={{ width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: "#f5f5f5" }}
              resizeMode="cover"
            />
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
  }, [screenWidth])

  // When player track changes, scroll slides accordingly
  const handleTrackFinish = useCallback(() => {
    const lastIndex = modules.length - 1
    if (currentSlideIndex >= lastIndex) {
      // If last slide, stay put; you can customize looping across slides if desired
      return
    }
    const next = currentSlideIndex + 1
    programmaticScrollRef.current = true
    flatListRef.current?.scrollToIndex({ index: next, animated: true })
    setCurrentSlideIndex(next)
  }, [currentSlideIndex, modules.length])

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
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
        <Text style={{ textAlign: "center", color: "#b71c1c" }}>{error}</Text>
      </SafeAreaView>
    )
  }

  if (!lesson) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
        <Text style={{ textAlign: "center" }}>Lesson not found.</Text>
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
          <Pressable
            onPress={() => setDiagnostics((v) => !v)}
            accessibilityLabel="Toggle diagnostics"
            hitSlop={8}
            style={{ padding: 4, marginLeft: 8 }}
          >
            <MaterialIcons name={diagnostics ? "bug-report" : "bug-report"} size={22} color={diagnostics ? "#ef4444" : "#9ca3af"} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          {modulesWithContent.length === 0 ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
              <Text style={{ textAlign: "center", color: "#666" }}>No modules available for this lesson.</Text>
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
          {/* Single-track player per slide */}
          {slideAudio[currentSlideIndex]?.audioUrl ? (
            <SingleTrackPlayer
              key={slideAudio[currentSlideIndex].id}
              track={{
                id: slideAudio[currentSlideIndex].id,
                title: modules[currentSlideIndex]?.title || undefined,
                audioUrl: slideAudio[currentSlideIndex].audioUrl as string,
              }}
              autoPlay={true}
              debug={diagnostics}
              onFinish={handleTrackFinish}
            />
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  )
}

export default LessonDetail

