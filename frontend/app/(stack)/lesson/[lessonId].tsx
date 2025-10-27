import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Dimensions, FlatList, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { MaterialIcons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"

import { extractModules, fetchLessonById, LessonDoc, MediaDoc, resolveMediaUrl } from "@/lib/payload"
import { AudioPlayer, type AudioTrack as PlayerTrack, type AudioPlayerHandle } from "@/components/AudioPlayer"

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
  const flatListRef = useRef<FlatList>(null)
  const playerRef = useRef<AudioPlayerHandle>(null)
  const { width: screenWidth } = Dimensions.get("window")

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

  const modules = useMemo(() => (lesson ? extractModules(lesson) : []), [lesson])

  const modulesWithContent = modules
  
  // Build player tracks and mapping to module indices
  const { tracks, trackIndexToModuleIndex } = useMemo(() => {
    const t: PlayerTrack[] = []
    const idxToModule: number[] = []
    modules.forEach((module, index) => {
      const audioUrl = resolveMediaUrl(module.audio)
      if (!audioUrl) return
      const displayOrder = formatOrder(module.order, index)
      const title = module.title ? `Module ${displayOrder}: ${module.title}` : `Module ${displayOrder}`
      t.push({ id: module.id, title, audioUrl })
      idxToModule.push(index)
    })
    return { tracks: t, trackIndexToModuleIndex: idxToModule }
  }, [modules])

  const showAudioPlayer = tracks.length > 0

  const onSlideScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x
    const index = Math.round(offsetX / screenWidth)
    setCurrentSlideIndex(index)
    if (showAudioPlayer && trackIndexToModuleIndex.length > 0) {
      const trackIndex = trackIndexToModuleIndex.findIndex((mIndex) => mIndex === index)
      if (trackIndex >= 0) {
        const currentTrack = playerRef.current?.getCurrentIndex()
        if (typeof currentTrack === "number" && currentTrack === trackIndex) {
          // Avoid redundant loads caused by programmatic scroll syncing
          // console.log(`[LessonDetail] Slide synced to current track ${trackIndex}, skipping goToTrack`)
          return
        }
        playerRef.current?.goToTrack(trackIndex, true)
      }
    }
  }, [screenWidth, showAudioPlayer, trackIndexToModuleIndex])

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
  const handlePlayerTrackChange = useCallback(
    (trackIdx: number) => {
      const moduleIdx = trackIndexToModuleIndex[trackIdx]
      if (typeof moduleIdx === "number") {
        flatListRef.current?.scrollToIndex({ index: moduleIdx, animated: true })
        setCurrentSlideIndex(moduleIdx)
      }
    },
    [trackIndexToModuleIndex]
  )

  // When track ends, also scroll to next slide
  const DEBUG_AUDIO = false
  const handlePlayerTrackEnd = useCallback(
    (trackIdx: number) => {
      if (DEBUG_AUDIO) console.log(`[LessonDetail] Track ${trackIdx} ended`)
      // Track end is handled by the player's auto-advance, 
      // which will trigger onTrackChange for the next track
    },
    [DEBUG_AUDIO]
  )

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
          <View style={{ width: 30 }} />
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
          {/* External Audio Player */}
          {showAudioPlayer ? (
            <AudioPlayer
              ref={playerRef}
              tracks={tracks}
              autoPlay={true}
              loop={true}
              onTrackChange={handlePlayerTrackChange}
              onTrackEnd={handlePlayerTrackEnd}
            />
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  )
}

export default LessonDetail

