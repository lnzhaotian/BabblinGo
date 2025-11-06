import React from "react"
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import type { LessonModuleSlide, LexicalRichText } from "@/lib/payload"
import { LexicalContent } from "@/components/LexicalContent"

export type TrackViewModel = {
  id: string
  title: string
  audioUrl: string | null
  rawAudioUrl: string | null
  imageUrl: string | null
  durationLabel?: string | null
  transcriptParagraphs: string[]
  isPlayable: boolean
}

type AudioPlaylistModuleProps = {
  slide: LessonModuleSlide
  screenWidth: number
  introduction: LexicalRichText | null | undefined
  tracks: TrackViewModel[]
  primaryTrackId: string | null
  downloadProgress: Record<string, number>
  cachedMedia: Record<string, string>
  colorScheme: "light" | "dark"
  onSelectTrack?: (trackId: string) => void
}

export const AudioPlaylistModule: React.FC<AudioPlaylistModuleProps> = ({
  slide,
  screenWidth,
  introduction,
  tracks,
  primaryTrackId,
  downloadProgress,
  cachedMedia,
  colorScheme,
  onSelectTrack,
}) => {
  const { t } = useTranslation()

  return (
    <View
      style={{
        width: screenWidth,
        paddingHorizontal: 16,
        paddingVertical: 0,
        alignItems: "center",
      }}
    >
      <View style={{ width: "100%", maxWidth: 640, gap: 20 }}>
        {introduction ? (
          <LexicalContent 
            content={introduction} 
            cachedMedia={cachedMedia}
            colorScheme={colorScheme}
            fontSize={16}
            lineHeight={24}
          />
        ) : null}

        {tracks.length > 0 ? (
          <View style={{ gap: 16 }}>
            {tracks.map((track) => {
              const isPrimary = track.id === primaryTrackId
              const progress = track.rawAudioUrl ? downloadProgress[track.rawAudioUrl] : undefined
              const isDownloading = typeof progress === "number" && progress >= 0 && progress < 1
              const isDisabled = !track.isPlayable

              return (
                <Pressable
                  key={track.id}
                  onPress={() => {
                    if (!isDisabled) {
                      onSelectTrack?.(track.id)
                    }
                  }}
                  disabled={isDisabled}
                  style={({ pressed }) => [
                    { opacity: isDisabled ? 0.6 : 1 },
                    pressed ? { transform: [{ scale: 0.99 }] } : undefined,
                  ]}
                >
                  <View
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
                              : t("lesson.audio.additionalTrack", { defaultValue: "Tap to play this track." })}
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
                </Pressable>
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
