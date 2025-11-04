import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Dimensions, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ThemedHeader } from "@/components/ThemedHeader"
import { CacheMenuModal } from "@/components/CacheMenuModal"
import { LessonHeaderControls } from "@/components/LessonHeaderControls"
import { AudioPlaylistModule, type TrackViewModel } from "./AudioPlaylistModule"
import { LessonAudioPlayer } from "@/components/LessonAudioPlayer"
import { useLessonPreferences } from "@/hooks/useLessonPreferences"
import { useLessonCache } from "@/hooks/useLessonCache"
import { LessonDoc, ModuleDoc, extractModuleSlides, resolveMediaUrl } from "@/lib/payload"
import { extractParagraphs } from "@/lib/lesson-helpers"
import { useThemeMode } from "@/app/theme-context"
import { useLearningSession } from "@/hooks/useLearningSession"

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

  const {
    playerSpeed,
    setPlayerSpeed,
    loopEnabled,
    setLoopEnabled,
  } = useLessonPreferences()

  useLearningSession(lesson.id, lesson.title, {
    enabled: false,
    speed: playerSpeed,
  })

  const introductionParagraphs = useMemo(() => {
    const preferred = slide?.body ?? slide?.audioPlaylist?.introduction ?? null
    return extractParagraphs(preferred)
  }, [slide?.body, slide?.audioPlaylist?.introduction])

  const tracks: TrackViewModel[] = useMemo(() => {
    const list = slide?.audioPlaylist?.tracks ?? []
    return list.map((track, index) => {
      const id = track?.id ?? `${module.id}-track-${index}`
      const rawAudioUrl = resolveMediaUrl(track?.audio ?? null)
      const cachedAudio = rawAudioUrl && cachedMedia[rawAudioUrl] ? cachedMedia[rawAudioUrl] : rawAudioUrl
      const rawImageUrl = resolveMediaUrl(track?.image ?? null)
      const cachedImage = rawImageUrl && cachedMedia[rawImageUrl] ? cachedMedia[rawImageUrl] : rawImageUrl
      const transcriptParagraphs = extractParagraphs(track?.transcript ?? null)
      const durationLabel = formatDuration(track?.durationSeconds ?? null)
      const title = typeof track?.title === "string" && track.title.trim().length > 0
        ? track.title
        : t("lesson.audio.untitledTrack", { defaultValue: "Untitled track" })

      return {
        id,
        title,
        audioUrl: cachedAudio,
        rawAudioUrl,
        imageUrl: cachedImage,
        durationLabel,
        transcriptParagraphs,
        isPlayable: Boolean(cachedAudio),
      }
    })
  }, [slide?.audioPlaylist?.tracks, cachedMedia, module.id, t])

  const playableTrackIndices = useMemo(() =>
    tracks.map((track, idx) => (track.audioUrl ? idx : -1)).filter((idx) => idx >= 0),
  [tracks])

  const hasAudioTracks = playableTrackIndices.length > 0

  const defaultTrackIndex = playableTrackIndices[0] ?? -1
  const [activeTrackIndex, setActiveTrackIndex] = useState(defaultTrackIndex)

  useEffect(() => {
    if (defaultTrackIndex === -1) {
      setActiveTrackIndex(-1)
      return
    }
    if (!playableTrackIndices.includes(activeTrackIndex)) {
      setActiveTrackIndex(defaultTrackIndex)
    }
  }, [defaultTrackIndex, playableTrackIndices, activeTrackIndex])

  const activeTrack = activeTrackIndex >= 0 ? tracks[activeTrackIndex] : null

  const selectTrackById = useCallback((trackId: string) => {
    const nextIndex = tracks.findIndex((track) => track.id === trackId && track.audioUrl)
    if (nextIndex >= 0) {
      setActiveTrackIndex(nextIndex)
    }
  }, [tracks])

  const effectiveLoopEnabled = hasAudioTracks ? loopEnabled : false

  const navigatePlayable = useCallback((direction: "prev" | "next") => {
    if (playableTrackIndices.length === 0) {
      return false
    }

    const currentIndex = playableTrackIndices.indexOf(activeTrackIndex)

    if (currentIndex === -1) {
      setActiveTrackIndex(playableTrackIndices[0])
      return true
    }

    if (direction === "prev") {
      if (currentIndex > 0) {
        setActiveTrackIndex(playableTrackIndices[currentIndex - 1])
        return true
      }
      if (effectiveLoopEnabled && playableTrackIndices.length > 1) {
        setActiveTrackIndex(playableTrackIndices[playableTrackIndices.length - 1])
        return true
      }
    } else {
      if (currentIndex < playableTrackIndices.length - 1) {
        setActiveTrackIndex(playableTrackIndices[currentIndex + 1])
        return true
      }
      if (effectiveLoopEnabled && playableTrackIndices.length > 1) {
        setActiveTrackIndex(playableTrackIndices[0])
        return true
      }
    }

    return false
  }, [activeTrackIndex, playableTrackIndices, effectiveLoopEnabled])

  const handlePlayerNavigate = useCallback((action: "prev" | "next") => {
    navigatePlayable(action)
  }, [navigatePlayable])

  const handlePlayerFinish = useCallback(() => navigatePlayable("next"), [navigatePlayable])

  const hasPrev = useMemo(() => {
    if (playableTrackIndices.length === 0) return false
    if (effectiveLoopEnabled && playableTrackIndices.length > 1) return true
    const currentIndex = playableTrackIndices.indexOf(activeTrackIndex)
    return currentIndex > 0
  }, [playableTrackIndices, effectiveLoopEnabled, activeTrackIndex])

  const hasNext = useMemo(() => {
    if (playableTrackIndices.length === 0) return false
    if (effectiveLoopEnabled && playableTrackIndices.length > 1) return true
    const currentIndex = playableTrackIndices.indexOf(activeTrackIndex)
    return currentIndex !== -1 && currentIndex < playableTrackIndices.length - 1
  }, [playableTrackIndices, effectiveLoopEnabled, activeTrackIndex])

  const queuedTrack = activeTrack && activeTrack.audioUrl
    ? {
        id: activeTrack.id,
        title: activeTrack.title,
        audioUrl: activeTrack.audioUrl,
      }
    : null

  const headerTitle = module.title || lesson.title

  return (
    <>
      <ThemedHeader
        overrideTitle={headerTitle}
        headerRight={() => (
          <LessonHeaderControls
            loopEnabled={effectiveLoopEnabled}
            cachingInProgress={cachingInProgress}
            cacheStatus={lessonCacheStatus}
            onToggleLoop={() => {
              if (!hasAudioTracks) return
              setLoopEnabled(!loopEnabled)
            }}
            onOpenCacheMenu={() => setCacheMenuVisible(true)}
            showLoopToggle={hasAudioTracks}
          />
        )}
      />

      <SafeAreaView
        style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#fff" }}
        edges={["bottom"]}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: colorScheme === "dark" ? "#e2e8f0" : "#0f172a" }}>
              {module.title}
            </Text>
            {module.summary ? (
              <Text style={{ fontSize: 16, color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>
                {module.summary}
              </Text>
            ) : null}
          </View>

          {slide ? (
            <AudioPlaylistModule
              slide={slide}
              screenWidth={screenWidth - 40}
              introductionParagraphs={introductionParagraphs}
              tracks={tracks}
              primaryTrackId={activeTrack?.id ?? null}
              downloadProgress={downloadProgress}
              onSelectTrack={selectTrackById}
            />
          ) : (
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: colorScheme === "dark" ? "#1e293b" : "#f1f5f9" }}>
              <Text style={{ color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>
                {t("lesson.audio.emptyPlaylist", { defaultValue: "No tracks available." })}
              </Text>
            </View>
          )}
        </ScrollView>

        <LessonAudioPlayer
          track={queuedTrack}
          playerSpeed={playerSpeed}
          loopEnabled={effectiveLoopEnabled}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onSpeedChange={setPlayerSpeed}
          onNavigate={handlePlayerNavigate}
          onFinish={handlePlayerFinish}
        />

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

const formatDuration = (seconds?: number | null): string | null => {
  if (typeof seconds !== "number" || Number.isNaN(seconds) || seconds <= 0) {
    return null
  }
  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const remainingSeconds = totalSeconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}
