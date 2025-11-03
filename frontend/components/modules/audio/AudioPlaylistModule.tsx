import React, { useMemo } from "react"
import { ActivityIndicator, Image, Text, View } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { resolveMediaUrl, type AudioTrackDoc, type LessonModuleSlide } from "@/lib/payload"
import { extractParagraphs } from "@/lib/lesson-helpers"

type TrackViewModel = {
  id: string
  title: string
  audioUrl: string | null
  rawAudioUrl: string | null
  imageUrl: string | null
  durationLabel?: string | null
  transcriptParagraphs: string[]
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

type AudioPlaylistModuleProps = {
  slide: LessonModuleSlide
  screenWidth: number
  cachedMedia: Record<string, string>
  downloadProgress: Record<string, number>
}

export const AudioPlaylistModule: React.FC<AudioPlaylistModuleProps> = ({
  slide,
  screenWidth,
  cachedMedia,
  downloadProgress,
}) => {
  const { t } = useTranslation()
  const introductionParagraphs = useMemo(() => {
    const preferred = slide.body ?? slide.audioPlaylist?.introduction ?? null
    return extractParagraphs(preferred)
  }, [slide.body, slide.audioPlaylist?.introduction])

  const tracks = useMemo<TrackViewModel[]>(() => {
    const list: (AudioTrackDoc | null | undefined)[] = slide.audioPlaylist?.tracks ?? []
    return list.map((track, index): TrackViewModel => {
      const id = track?.id ?? `${slide.moduleId}-track-${index}`
      const rawAudioUrl = resolveMediaUrl(track?.audio ?? null)
      const cachedAudio = rawAudioUrl && cachedMedia[rawAudioUrl] ? cachedMedia[rawAudioUrl] : rawAudioUrl
      const rawImageUrl = resolveMediaUrl(track?.image ?? null)
      const cachedImage = rawImageUrl && cachedMedia[rawImageUrl] ? cachedMedia[rawImageUrl] : rawImageUrl
      return {
        id,
        title: (track?.title ?? t("lesson.audio.untitledTrack", { defaultValue: "Untitled track" })) as string,
        audioUrl: cachedAudio,
        rawAudioUrl,
        imageUrl: cachedImage,
        durationLabel: formatDuration(track?.durationSeconds ?? null),
        transcriptParagraphs: extractParagraphs(track?.transcript ?? null),
      }
    })
  }, [slide.audioPlaylist, slide.moduleId, cachedMedia, t])

  const primaryTrackId = useMemo(() => {
    const playable = tracks.find((track) => Boolean(track.audioUrl))
    return playable?.id ?? null
  }, [tracks])

  return (
    <View
      style={{
        width: screenWidth,
        paddingHorizontal: 16,
        paddingVertical: 24,
        alignItems: "center",
      }}
    >
      <View style={{ width: "100%", maxWidth: 640, gap: 20 }}>
        <View>
          <Text style={{ fontSize: 22, fontWeight: "700" }}>{slide.title}</Text>
          {slide.summary ? <Text style={{ marginTop: 4, color: "#6b7280" }}>{slide.summary}</Text> : null}
        </View>

        {introductionParagraphs.length > 0 ? (
          <View style={{ gap: 12 }}>
            {introductionParagraphs.map((paragraph, idx) => (
              <Text key={idx} style={{ fontSize: 16, lineHeight: 22, color: "#1f2937" }}>
                {paragraph}
              </Text>
            ))}
          </View>
        ) : null}

        {tracks.length > 0 ? (
          <View style={{ gap: 16 }}>
            {tracks.map((track) => {
              const isPrimary = track.id === primaryTrackId
              const progress = track.rawAudioUrl ? downloadProgress[track.rawAudioUrl] : undefined
              const isDownloading = typeof progress === "number" && progress >= 0 && progress < 1

              return (
                <View
                  key={track.id}
                  style={{
                    borderRadius: 16,
                    borderWidth: isPrimary ? 2 : 1,
                    borderColor: isPrimary ? "#6366f1" : "#e5e7eb",
                    backgroundColor: isPrimary ? "#eef2ff" : "#f9fafb",
                    padding: 16,
                    gap: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    {track.imageUrl ? (
                      <Image
                        source={{ uri: track.imageUrl }}
                        style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: "#d1d5db" }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 12,
                          backgroundColor: isPrimary ? "#c7d2fe" : "#e5e7eb",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <MaterialIcons name="library-music" size={28} color={isPrimary ? "#3730a3" : "#6b7280"} />
                      </View>
                    )}

                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#111827" }}>{track.title}</Text>
                      {track.durationLabel ? (
                        <Text style={{ color: "#6b7280", fontSize: 13 }}>{track.durationLabel}</Text>
                      ) : null}
                      {track.audioUrl ? (
                        <Text style={{ color: "#4b5563", fontSize: 13 }}>
                          {isPrimary
                            ? t("lesson.audio.primaryTrack", { defaultValue: "Queued in the audio controls." })
                            : t("lesson.audio.additionalTrack", { defaultValue: "Available as part of this playlist." })}
                        </Text>
                      ) : (
                        <Text style={{ color: "#b91c1c", fontSize: 13 }}>
                          {t("lesson.audio.missingTrack", { defaultValue: "Audio file missing." })}
                        </Text>
                      )}
                    </View>
                  </View>

                  {isDownloading ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator size="small" color="#6366f1" />
                      <Text style={{ fontSize: 12, color: "#4f46e5" }}>
                        {t("lesson.downloading", { defaultValue: "Downloading..." })}
                      </Text>
                    </View>
                  ) : null}

                  {track.transcriptParagraphs.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {track.transcriptParagraphs.map((paragraph, idx) => (
                        <Text key={idx} style={{ fontSize: 14, lineHeight: 20, color: "#374151" }}>
                          {paragraph}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              )
            })}
          </View>
        ) : (
          <Text style={{ fontStyle: "italic", color: "#9ca3af" }}>
            {t("lesson.audio.emptyPlaylist", { defaultValue: "No tracks available." })}
          </Text>
        )}
      </View>
    </View>
  )
}
