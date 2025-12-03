import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native"
import { Image } from "expo-image"
import { SafeAreaView } from "react-native-safe-area-context"
import { VideoView, useVideoPlayer, type ContentType, type PlayerError, type VideoPlayerStatus } from "expo-video"
import { useTranslation } from "react-i18next"
import { MaterialIcons } from "@expo/vector-icons"

import { LessonDoc, ModuleDoc, extractModuleSlides, resolveMediaUrl } from "@/lib/payload"
import { useThemeMode } from "@/app/theme-context"
import { useLearningSession } from "@/hooks/useLearningSession"
import { useLessonCache } from "@/hooks/useLessonCache"
import { ThemedHeader } from "@/components/ThemedHeader"
import { LessonHeaderControls } from "@/components/LessonHeaderControls"
import { CacheMenuModal } from "@/components/CacheMenuModal"
import { LexicalContent } from "@/components/LexicalContent"
import { PronunciationModal } from "@/components/PronunciationModal"
import { useLessonPreferences } from "@/hooks/useLessonPreferences"

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const formatTime = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "00:00"
  const totalSeconds = Math.floor(seconds)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
}

export type VideoModuleViewProps = {
  lesson: LessonDoc
  module: ModuleDoc
}

export const VideoModuleView: React.FC<VideoModuleViewProps> = ({
  lesson,
  module,
}) => {
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode()
  const videoRef = useRef<VideoView | null>(null)
  const [playerStatus, setPlayerStatus] = useState<VideoPlayerStatus>("idle")
  const [playerError, setPlayerError] = useState<PlayerError | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackMetrics, setPlaybackMetrics] = useState({ currentTime: 0, duration: 0, buffered: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [nativeControlsEnabled, setNativeControlsEnabled] = useState(false)
  const progressWidthRef = useRef(0)
  const isSeekingRef = useRef(false)

  const { maxAttempts } = useLessonPreferences()
  const [practiceMode, setPracticeMode] = useState(false)
  const [pronunciationModalVisible, setPronunciationModalVisible] = useState(false)
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const [showTranscript, setShowTranscript] = useState(false)
  const [showFloatingSubtitle, setShowFloatingSubtitle] = useState(false)

  useLearningSession(lesson.id, lesson.title, {
    enabled: false,
    courseId: typeof lesson.course === 'string' ? lesson.course : lesson.course.id,
    defaultTrackingEnabled: typeof lesson.course === 'object' ? (lesson.course.defaultTrackingEnabled ?? undefined) : undefined,
  })

  const slide = useMemo(() => {
    const slides = extractModuleSlides(module)
    return slides[0] ?? null
  }, [module])

  const videoContent = slide?.video ?? module.video ?? null

  const transcriptSegments = useMemo(() => {
      return videoContent?.transcriptSegments ?? []
  }, [videoContent])

  const currentSegment = useMemo(() => {
    if (!practiceMode || !transcriptSegments || transcriptSegments.length === 0) {
      return null
    }
    return transcriptSegments[currentSegmentIndex]
  }, [practiceMode, transcriptSegments, currentSegmentIndex])

  const activeSegment = useMemo(() => {
    if (practiceMode || !transcriptSegments || transcriptSegments.length === 0) return null
    const time = playbackMetrics.currentTime
    return transcriptSegments.find(s => time >= s.start && time < s.end)
  }, [practiceMode, transcriptSegments, playbackMetrics.currentTime])

  const {
    cachedMedia,
    cachingInProgress,
    lessonCacheStatus,
    cacheMenuVisible,
    setCacheMenuVisible,
    handleClearCache,
    handleRedownload,
  } = useLessonCache(lesson)

  const rawPosterUrl = useMemo(
    () => resolveMediaUrl(videoContent?.posterImage ?? slide?.image ?? null),
    [videoContent?.posterImage, slide?.image]
  )
  const posterUrl = useMemo(() => {
    if (!rawPosterUrl) return null
    return cachedMedia[rawPosterUrl] ?? rawPosterUrl
  }, [cachedMedia, rawPosterUrl])

  const rawVideoFileUrl = useMemo(
    () => resolveMediaUrl(videoContent?.videoFile ?? null),
    [videoContent?.videoFile]
  )

  const streamUrlKey = useMemo(() => {
    const stream = typeof videoContent?.streamUrl === "string" ? videoContent.streamUrl.trim() : ""
    if (!stream || stream.toLowerCase().endsWith(".m3u8")) {
      return null
    }
    const resolved = resolveMediaUrl(stream)
    return resolved ?? stream
  }, [videoContent?.streamUrl])

  const videoUrl = useMemo(() => {
    if (rawVideoFileUrl) {
      return cachedMedia[rawVideoFileUrl] ?? rawVideoFileUrl
    }
    if (streamUrlKey) {
      return cachedMedia[streamUrlKey] ?? streamUrlKey
    }
    return typeof videoContent?.streamUrl === "string" ? videoContent.streamUrl : null
  }, [cachedMedia, rawVideoFileUrl, streamUrlKey, videoContent?.streamUrl])

  const videoSource = useMemo(() => {
    if (!videoUrl) return null
    if (videoContent?.streamUrl && !rawVideoFileUrl) {
      const stream = typeof videoContent.streamUrl === "string" ? videoContent.streamUrl : ""
      const isHls = stream.toLowerCase().endsWith(".m3u8")
      const contentType: ContentType = isHls ? "hls" : "auto"
      return {
        uri: videoUrl,
        contentType,
      }
    }

    return {
      uri: videoUrl,
    }
  }, [videoUrl, videoContent?.streamUrl, rawVideoFileUrl])

  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = false
    instance.timeUpdateEventInterval = 0.5
    instance.staysActiveInBackground = true
  })

  useEffect(() => {
    setNativeControlsEnabled(false)
  }, [videoSource])

  useEffect(() => {
    let active = true

    const loadSource = async () => {
      if (!videoSource) {
        if (!active) return
        setPlayerStatus("idle")
        setPlayerError(null)
        setIsPlaying(false)
        setPlaybackMetrics({ currentTime: 0, duration: 0, buffered: 0 })
        try { player.pause() } catch {}
        return
      }

      setPlayerStatus("loading")
      setPlayerError(null)
      setIsPlaying(false)
      setPlaybackMetrics((prev) => ({ ...prev, currentTime: 0 }))

      try {
        if (typeof player.replaceAsync === "function") {
          await player.replaceAsync(videoSource)
        } else {
          await player.replace(videoSource)
        }
        if (!active) return

        try { player.currentTime = 0 } catch {}
        if (!active) return

        setIsMuted(player.muted ?? false)
        setPlaybackMetrics({
          currentTime: 0,
          duration: player.duration ?? 0,
          buffered: player.bufferedPosition ?? 0,
        })
        setPlayerStatus(player.status)
      } catch (error) {
        if (!active) return
        setPlayerError(error as PlayerError)
        setPlayerStatus("error")
      }
    }

    void loadSource()

    return () => {
      active = false
    }
  }, [player, videoSource])

  useEffect(() => {
    setPlayerStatus(player.status)

    const statusSub = player.addListener("statusChange", ({ status, error }) => {
      setPlayerStatus(status)
      setPlayerError(error ?? null)
    })

    const playingSub = player.addListener("playingChange", ({ isPlaying: nextPlaying }) => {
      setIsPlaying(nextPlaying)
    })

    const rateSub = player.addListener("playbackRateChange", ({ playbackRate: nextRate }) => {
      setPlaybackRate(nextRate)
    })

    const mutedSub = player.addListener("mutedChange", ({ muted }) => {
      setIsMuted(muted)
    })

    const timeSub = player.addListener("timeUpdate", ({ currentTime, bufferedPosition }) => {
      setPlaybackMetrics((prev) => ({
        ...prev,
        currentTime,
        buffered: bufferedPosition,
      }))
    })

    const sourceLoadSub = player.addListener("sourceLoad", ({ duration }) => {
      setPlaybackMetrics((prev) => ({
        ...prev,
        duration,
      }))
    })

    const endSub = player.addListener("playToEnd", () => {
      setIsPlaying(false)
      setPlaybackMetrics((prev) => ({
        ...prev,
        currentTime: prev.duration,
      }))
    })

    setPlaybackRate(player.playbackRate)
    setIsPlaying(player.playing)
    setIsMuted(player.muted ?? false)
    setPlaybackMetrics({
      currentTime: player.currentTime ?? 0,
      duration: player.duration ?? 0,
      buffered: player.bufferedPosition ?? 0,
    })

    return () => {
      statusSub.remove()
      playingSub.remove()
      rateSub.remove()
      mutedSub.remove()
      timeSub.remove()
      sourceLoadSub.remove()
      endSub.remove()
    }
  }, [player])

  // Listen & Repeat Logic
  useEffect(() => {
    if (practiceMode && currentSegment && isPlaying && !isSeekingRef.current) {
      if (playbackMetrics.currentTime >= currentSegment.end) {
        try { player.pause() } catch {}
        setIsPlaying(false)
        setPronunciationModalVisible(true)
      }
    }
  }, [playbackMetrics.currentTime, practiceMode, currentSegment, isPlaying, player])

  // When entering practice mode or changing segment, seek to start
  useEffect(() => {
    if (practiceMode && currentSegment) {
       isSeekingRef.current = true
       setTimeout(() => { isSeekingRef.current = false }, 1000)
       
       // Small delay to allow audio session to reset if coming from modal
       const timer = setTimeout(() => {
         try {
           player.currentTime = currentSegment.start
           player.play()
         } catch {}
       }, 300)

       setPlaybackMetrics((prev) => ({ ...prev, currentTime: currentSegment.start }))
       return () => clearTimeout(timer)
    }
  }, [currentSegment, practiceMode, player])

  const transcript = useMemo(
    () => videoContent?.transcript ?? slide?.transcript ?? null,
    [videoContent?.transcript, slide?.transcript]
  )

  const loading = Boolean(videoUrl) && (playerStatus === "idle" || playerStatus === "loading")
  const hasError = playerStatus === "error" || Boolean(playerError)
  const controlsDisabled = !videoUrl || hasError || loading
  const durationSeconds = playbackMetrics.duration > 0 ? playbackMetrics.duration : 0
  const progressRatio = durationSeconds > 0 ? clamp(playbackMetrics.currentTime / durationSeconds, 0, 1) : 0
  const bufferedRatio = durationSeconds > 0 && playbackMetrics.buffered >= 0
    ? clamp(playbackMetrics.buffered / durationSeconds, 0, 1)
    : 0
  const progressPercent: `${number}%` = `${Math.min(100, Math.max(0, progressRatio * 100))}%`
  const bufferedPercent: `${number}%` = `${Math.min(100, Math.max(0, bufferedRatio * 100))}%`
  const currentTimeLabel = formatTime(playbackMetrics.currentTime)
  const durationLabel = formatTime(durationSeconds)
  const scrubDisabled = controlsDisabled || durationSeconds <= 0
  const muteLabel = isMuted
    ? t("lesson.video.controls.unmute", { defaultValue: "Unmute" })
    : t("lesson.video.controls.mute", { defaultValue: "Mute" })
  const fullscreenLabel = isFullscreen
    ? t("lesson.video.controls.exitFullscreen", { defaultValue: "Exit fullscreen" })
    : t("lesson.video.controls.fullscreen", { defaultValue: "Fullscreen" })

  const handleTogglePlay = useCallback(async () => {
    if (controlsDisabled) return
    if (player.playing) {
      try { player.pause() } catch {}
      setIsPlaying(false)
      return
    }

    try {
      const currentTime = player.currentTime ?? 0
      const duration = player.duration ?? 0
      if (duration > 0 && currentTime >= duration - 0.5) {
        handleSeekTo(0)
      }
    } catch {}

    try {
      player.play()
      setIsPlaying(true)
    } catch {}
  }, [controlsDisabled, player, handleSeekTo])

  const handleSeek = useCallback((seconds: number) => {
    if (controlsDisabled) return
    isSeekingRef.current = true
    setTimeout(() => { isSeekingRef.current = false }, 1000)
    try { player.seekBy(seconds) } catch {}
    setPlaybackMetrics((prev) => {
      const duration = prev.duration > 0 ? prev.duration : player.duration ?? prev.duration
      const maxDuration = duration > 0 ? duration : Math.max(prev.currentTime + seconds, 0)
      const nextTime = clamp(prev.currentTime + seconds, 0, maxDuration)
      
      if (practiceMode && transcriptSegments) {
        const idx = transcriptSegments.findIndex(s => nextTime >= s.start && nextTime < s.end)
        if (idx !== -1) setCurrentSegmentIndex(idx)
      }

      return { ...prev, currentTime: nextTime }
    })
  }, [controlsDisabled, player, practiceMode, transcriptSegments])

  const handleSeekTo = useCallback((time: number) => {
    if (controlsDisabled) return
    isSeekingRef.current = true
    setTimeout(() => { isSeekingRef.current = false }, 1000)
    try { player.currentTime = time } catch {}
    setPlaybackMetrics((prev) => ({ ...prev, currentTime: time }))
  }, [controlsDisabled, player])

  const handleTogglePracticeMode = useCallback(() => {
    if (!practiceMode) {
      // Entering practice mode: sync segment to current time
      if (transcriptSegments && transcriptSegments.length > 0) {
        const time = playbackMetrics.currentTime
        const segmentIndex = transcriptSegments.findIndex(
          (s) => time >= s.start && time < s.end
        )
        if (segmentIndex >= 0) {
          setCurrentSegmentIndex(segmentIndex)
        } else {
           // If past the last segment, select the last one
           const lastSegment = transcriptSegments[transcriptSegments.length - 1]
           if (time >= lastSegment.end) {
             setCurrentSegmentIndex(transcriptSegments.length - 1)
           } else {
             setCurrentSegmentIndex(0)
           }
        }
      }
    }
    setPracticeMode((prev) => !prev)
  }, [practiceMode, transcriptSegments, playbackMetrics.currentTime])

  const handleSetRate = useCallback((rate: number) => {
    if (!videoUrl || hasError) return
    player.playbackRate = rate
    setPlaybackRate(rate)
  }, [hasError, player, videoUrl])

  const handleToggleMute = useCallback(() => {
    if (!videoUrl || hasError) return
    try {
      const nextMuted = !isMuted
      player.muted = nextMuted
      setIsMuted(nextMuted)
    } catch {}
  }, [hasError, isMuted, player, videoUrl])

  const handleToggleFullscreen = useCallback(async () => {
    if (controlsDisabled || !videoRef.current) return
    try {
      if (isFullscreen) {
        await videoRef.current.exitFullscreen()
        setNativeControlsEnabled(false)
      } else {
        setNativeControlsEnabled(true)
        await videoRef.current.enterFullscreen()
      }
    } catch {
      if (!isFullscreen) setNativeControlsEnabled(false)
    }
  }, [controlsDisabled, isFullscreen])

  const handleProgressLayout = useCallback((event: LayoutChangeEvent) => {
    progressWidthRef.current = event.nativeEvent.layout.width
  }, [])

  const handlePronunciationSuccess = useCallback(() => {
    setPronunciationModalVisible(false)
    setRetryCount(0)
    if (transcriptSegments && currentSegmentIndex < transcriptSegments.length - 1) {
        setCurrentSegmentIndex(prev => prev + 1)
    } else {
        setPracticeMode(false)
    }
  }, [transcriptSegments, currentSegmentIndex])

  const handlePronunciationFail = useCallback(() => {
    setPronunciationModalVisible(false)
    if (retryCount < maxAttempts - 1) {
      setRetryCount(prev => prev + 1)
      if (currentSegment) {
          handleSeekTo(currentSegment.start)
          try { player.play() } catch {}
      }
    } else {
      setRetryCount(0)
      if (transcriptSegments && currentSegmentIndex < transcriptSegments.length - 1) {
        setCurrentSegmentIndex(prev => prev + 1)
      } else {
        setPracticeMode(false)
      }
    }
  }, [retryCount, maxAttempts, transcriptSegments, currentSegmentIndex, currentSegment, player, handleSeekTo])

  const handlePronunciationClose = useCallback(() => {
      setPronunciationModalVisible(false)
      if (transcriptSegments && currentSegmentIndex < transcriptSegments.length - 1) {
        setCurrentSegmentIndex(prev => prev + 1)
      } else {
        setPracticeMode(false)
      }
  }, [transcriptSegments, currentSegmentIndex])

  const handleScrub = useCallback((event: GestureResponderEvent) => {
    if (scrubDisabled) return
    const width = progressWidthRef.current
    if (!width) return
    const fraction = clamp(event.nativeEvent.locationX / width, 0, 1)
    const nextTime = fraction * durationSeconds
    try {
      player.currentTime = nextTime
    } catch {}
    setPlaybackMetrics((prev) => ({ ...prev, currentTime: nextTime }))

    if (practiceMode && transcriptSegments) {
      const idx = transcriptSegments.findIndex(s => nextTime >= s.start && nextTime < s.end)
      if (idx !== -1) setCurrentSegmentIndex(idx)
    }
  }, [durationSeconds, player, scrubDisabled, practiceMode, transcriptSegments])

  const speedPresets = useMemo(() => [0.5, 0.7, 1, 1.3, 1.5, 2], [])

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
            practiceModeEnabled={practiceMode}
            onTogglePracticeMode={handleTogglePracticeMode}
            showPracticeToggle={transcriptSegments.length > 0}
          />
        )}
      />
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#18181b" : "#fff" }}
        edges={["bottom"]}
      >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}>
        {module.summary ? (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: colorScheme === "dark" ? "#14213d" : "#f8fafc",
            }}
          >
            <Text style={{ fontSize: 16, color: colorScheme === "dark" ? "#cbd5f5" : "#334155", lineHeight: 22 }}>
              {module.summary}
            </Text>
          </View>
        ) : null}

        {videoUrl ? (
          <View style={{ gap: 12 }}>
            <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: "#0f172a" }}>
              <VideoView
                ref={videoRef}
                player={player}
                style={{ width: "100%", aspectRatio: 16 / 9 }}
                contentFit="contain"
                nativeControls={nativeControlsEnabled}
                allowsFullscreen={true}
                onFullscreenEnter={() => {
                  setIsFullscreen(true)
                  setNativeControlsEnabled(true)
                }}
                onFullscreenExit={() => {
                  setIsFullscreen(false)
                  setNativeControlsEnabled(false)
                }}
              />
              {posterUrl && loading ? (
                <Image
                  source={{ uri: posterUrl }}
                  style={{ position: "absolute", inset: 0 }}
                  contentFit="cover"
                />
              ) : null}
              {loading && !hasError ? (
                <View
                  style={{
                    position: "absolute",
                    inset: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(15,23,42,0.35)",
                    gap: 10,
                  }}
                >
                  <ActivityIndicator size="large" color="#e0e7ff" />
                  <Text style={{ color: "#e0e7ff" }}>
                    {t("lesson.video.preparing", { defaultValue: "Preparing video..." })}
                  </Text>
                </View>
              ) : null}
              {hasError ? (
                <View
                  style={{
                    position: "absolute",
                    inset: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(15,23,42,0.6)",
                    paddingHorizontal: 16,
                  }}
                >
                  <Text style={{ color: "#fca5a5", fontWeight: "600", textAlign: "center" }}>
                    {t("lesson.video.error", { defaultValue: "Unable to load video." })}
                  </Text>
                </View>
              ) : null}
              {showFloatingSubtitle && (practiceMode ? currentSegment : activeSegment) ? (
                  <View style={{
                      position: "absolute",
                      bottom: 20,
                      left: 20,
                      right: 20,
                      backgroundColor: "rgba(0,0,0,0.7)",
                      padding: 12,
                      borderRadius: 8,
                  }}>
                      <Text style={{ color: "#fff", fontSize: 16, textAlign: "center" }}>
                          {(practiceMode ? currentSegment : activeSegment)?.text}
                      </Text>
                  </View>
              ) : null}
            </View>

            <View
              style={{
                borderRadius: 16,
                backgroundColor: colorScheme === "dark" ? "#111827" : "#f8fafc",
                padding: 16,
                gap: 18,
              }}
            >
              <View style={{ gap: 8 }}>
                <Pressable
                  onPress={handleScrub}
                  disabled={scrubDisabled}
                  hitSlop={8}
                  accessibilityLabel={t("lesson.video.controls.scrub", { defaultValue: "Seek position" })}
                  style={({ pressed }) => ({
                    paddingVertical: 4,
                    opacity: scrubDisabled ? 0.45 : pressed ? 0.85 : 1,
                  })}
                >
                  <View
                    onLayout={handleProgressLayout}
                    style={{
                      height: 6,
                      borderRadius: 999,
                      backgroundColor: colorScheme === "dark" ? "#1f2937" : "#e2e8f0",
                      overflow: "visible",
                    }}
                  >
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: bufferedPercent,
                        backgroundColor: colorScheme === "dark" ? "#334155" : "#cbd5f5",
                        opacity: 0.6,
                      }}
                    />
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: progressPercent,
                        backgroundColor: "#6366f1",
                      }}
                    />
                    {!scrubDisabled ? (
                      <View
                        style={{
                          position: "absolute",
                          top: -5,
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: "#6366f1",
                          left: progressPercent,
                          marginLeft: -7,
                          borderWidth: 2,
                          borderColor: colorScheme === "dark" ? "#111827" : "#f8fafc",
                        }}
                      />
                    ) : null}
                  </View>
                </Pressable>

                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colorScheme === "dark" ? "#cbd5f5" : "#1f2937", fontVariant: ["tabular-nums"], fontSize: 13 }}>
                    {currentTimeLabel}
                  </Text>
                  <Text style={{ color: colorScheme === "dark" ? "#cbd5f5" : "#1f2937", fontVariant: ["tabular-nums"], fontSize: 13 }}>
                    {durationLabel}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <CircleButton
                  icon="replay-10"
                  onPress={() => handleSeek(-10)}
                  disabled={controlsDisabled}
                  accessibilityLabel={t("lesson.video.controls.rewind", { defaultValue: "Back 10s" })}
                  variant="secondary"
                />
                <CircleButton
                  icon={isPlaying ? "pause" : "play-arrow"}
                  onPress={handleTogglePlay}
                  disabled={controlsDisabled}
                  accessibilityLabel={isPlaying
                    ? t("lesson.video.controls.pause", { defaultValue: "Pause" })
                    : t("lesson.video.controls.play", { defaultValue: "Play" })}
                  variant="primary"
                />
                <CircleButton
                  icon="forward-10"
                  onPress={() => handleSeek(10)}
                  disabled={controlsDisabled}
                  accessibilityLabel={t("lesson.video.controls.forward", { defaultValue: "Forward 10s" })}
                  variant="secondary"
                />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <CircleButton
                  icon={isMuted ? "volume-off" : "volume-up"}
                  onPress={handleToggleMute}
                  disabled={controlsDisabled}
                  accessibilityLabel={muteLabel}
                  variant="secondary"
                  active={isMuted}
                />
                {transcriptSegments.length > 0 ? (
                  <CircleButton
                    icon={showFloatingSubtitle ? "closed-caption" : "closed-caption-off"}
                    onPress={() => setShowFloatingSubtitle(!showFloatingSubtitle)}
                    disabled={controlsDisabled}
                    accessibilityLabel={showFloatingSubtitle 
                      ? t("lesson.video.controls.hideCaptions", { defaultValue: "Hide Captions" }) 
                      : t("lesson.video.controls.showCaptions", { defaultValue: "Show Captions" })
                    }
                    variant="secondary"
                    active={showFloatingSubtitle}
                  />
                ) : null}
                <CircleButton
                  icon={isFullscreen ? "fullscreen-exit" : "fullscreen"}
                  onPress={handleToggleFullscreen}
                  disabled={controlsDisabled}
                  accessibilityLabel={fullscreenLabel}
                  variant="secondary"
                  active={isFullscreen}
                />
              </View>

              <View style={{ gap: 8, alignItems: "center" }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {speedPresets.map((rate) => {
                    const isSelected = Math.abs(rate - playbackRate) < 0.05
                    const formattedValue = Number.isInteger(rate)
                      ? String(rate.toFixed(1))
                      : rate % 0.5 === 0
                        ? rate.toFixed(1)
                        : rate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
                    return (
                      <Pressable
                        key={`video-speed-${rate}`}
                        onPress={() => handleSetRate(rate)}
                        disabled={controlsDisabled}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 6,
                          backgroundColor: isSelected
                            ? "#6366f1"
                            : colorScheme === "dark" ? "#1f2937" : "#e2e8f0",
                          opacity: controlsDisabled && !isSelected ? 0.6 : 1,
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? "#fff" : colorScheme === "dark" ? "#cbd5f5" : "#1f2937",
                            fontWeight: "600",
                          }}
                        >
                          {t("lesson.video.controls.speedLabel", { defaultValue: "{{value}}x", value: formattedValue })}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View
            style={{
              padding: 20,
              borderRadius: 16,
              backgroundColor: colorScheme === "dark" ? "#1e293b" : "#f1f5f9",
            }}
          >
            <Text style={{ color: colorScheme === "dark" ? "#f1f5f9" : "#0f172a", fontSize: 16 }}>
              {t("lesson.video.missing", { defaultValue: "Video file is not available." })}
            </Text>
          </View>
        )}

        {(transcript || transcriptSegments.length > 0) ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 18, fontWeight: "600", color: colorScheme === "dark" ? "#e2e8f0" : "#0f172a" }}>
                {t("lesson.video.transcript", { defaultValue: "Transcript" })}
              </Text>
              {transcriptSegments.length > 0 ? (
                <Pressable
                  onPress={() => setShowTranscript(!showTranscript)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 8,
                    backgroundColor: showTranscript ? (colorScheme === "dark" ? "#312e81" : "#c7d2fe") : "transparent",
                  }}
                >
                  <MaterialIcons 
                    name={showTranscript ? "expand-less" : "expand-more"} 
                    size={20} 
                    color={colorScheme === "dark" ? "#818cf8" : "#4f46e5"} 
                  />
                  <Text style={{ color: colorScheme === "dark" ? "#818cf8" : "#4f46e5", fontSize: 14, fontWeight: "500" }}>
                    {showTranscript 
                      ? t("lesson.audio.hideTranscript", { defaultValue: "Hide Transcript" })
                      : t("lesson.audio.showTranscript", { defaultValue: "Show Transcript" })
                    }
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {showTranscript && transcriptSegments.length > 0 ? (
              <View style={{ gap: 8, padding: 12, backgroundColor: colorScheme === "dark" ? "#1e293b" : "#fff", borderRadius: 8 }}>
                {transcriptSegments.map((segment, idx) => {
                  const isActive = playbackMetrics.currentTime >= segment.start && playbackMetrics.currentTime < segment.end
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => {
                        handleSeekTo(segment.start)
                        if (practiceMode) {
                          setCurrentSegmentIndex(idx)
                        }
                      }}
                    >
                      <Text 
                        style={{ 
                          fontSize: 16, 
                          lineHeight: 26, 
                          color: isActive ? (colorScheme === "dark" ? "#818cf8" : "#4f46e5") : (colorScheme === "dark" ? "#cbd5e1" : "#374151"),
                          fontWeight: isActive ? "600" : "400",
                          backgroundColor: isActive ? (colorScheme === "dark" ? "#312e81" : "#eef2ff") : "transparent",
                          padding: 6,
                          borderRadius: 6,
                        }}
                      >
                        {segment.text}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            ) : (
              transcript ? (
                <LexicalContent
                  content={transcript}
                  cachedMedia={cachedMedia}
                  colorScheme={colorScheme}
                  fontSize={16}
                  lineHeight={24}
                />
              ) : null
            )}
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

      <PronunciationModal
        visible={pronunciationModalVisible}
        transcript={currentSegment?.text ?? ""}
        onSuccess={handlePronunciationSuccess}
        onFail={handlePronunciationFail}
        onClose={handlePronunciationClose}
      />
    </SafeAreaView>
    </>
  )
}
type CircleButtonProps = {
  icon: React.ComponentProps<typeof MaterialIcons>["name"]
  onPress: () => void
  disabled?: boolean
  accessibilityLabel?: string
  variant?: "primary" | "secondary"
  active?: boolean
}

const CircleButton: React.FC<CircleButtonProps> = ({ icon, onPress, disabled, accessibilityLabel, variant = "secondary", active = false }) => {
  const { colorScheme } = useThemeMode()
  const isDark = colorScheme === "dark"

  const background = variant === "primary"
    ? "#6366f1"
    : active
      ? (isDark ? "#312e81" : "#c7d2fe")
      : (isDark ? "#1f2937" : "#e2e8f0")

  const size = variant === "primary" ? 56 : 44
  const borderColor = variant === "primary" ? "transparent" : (active ? "#6366f1" : "transparent")
  const iconColor = variant === "primary"
    ? "#fff"
    : active
      ? (isDark ? "#ede9fe" : "#312e81")
      : (isDark ? "#e2e8f0" : "#1f2937")

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: background,
        opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        shadowColor: variant === "primary" ? "#6366f1" : "#000",
        shadowOpacity: variant === "primary" ? 0.3 : 0,
        shadowRadius: variant === "primary" ? 6 : 0,
        shadowOffset: variant === "primary" ? { width: 0, height: 2 } : { width: 0, height: 0 },
        borderWidth: borderColor === "transparent" ? 0 : 1.5,
        borderColor,
      })}
    >
      <MaterialIcons
        name={icon}
        size={variant === "primary" ? 30 : 24}
        color={iconColor}
      />
    </Pressable>
  )
}
