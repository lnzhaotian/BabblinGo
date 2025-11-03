import React, { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, ScrollView, Text, View } from "react-native"
import { Image } from "expo-image"
import { SafeAreaView } from "react-native-safe-area-context"
import { VideoView, useVideoPlayer, type PlayerError, type VideoPlayerStatus } from "expo-video"
import { useTranslation } from "react-i18next"

import { ThemedHeader } from "@/components/ThemedHeader"
import { LessonDoc, ModuleDoc, extractModuleSlides, resolveMediaUrl } from "@/lib/payload"
import { extractParagraphs } from "@/lib/lesson-helpers"
import { useThemeMode } from "@/app/theme-context"

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
  const [playerStatus, setPlayerStatus] = useState<VideoPlayerStatus>("idle")
  const [playerError, setPlayerError] = useState<PlayerError | null>(null)

  const slide = useMemo(() => {
    const slides = extractModuleSlides(module)
    return slides[0] ?? null
  }, [module])

  const videoContent = slide?.video ?? module.video ?? null
  const posterUrl = useMemo(() => resolveMediaUrl(videoContent?.posterImage ?? slide?.image ?? null), [videoContent?.posterImage, slide?.image])

  const videoUrl = useMemo(() => {
    const fileUrl = resolveMediaUrl(videoContent?.videoFile ?? null)
    if (fileUrl) return fileUrl
    return videoContent?.streamUrl ?? null
  }, [videoContent?.videoFile, videoContent?.streamUrl])

  const videoSource = useMemo(() => (videoUrl ? { uri: videoUrl } : null), [videoUrl])

  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = false
  })

  useEffect(() => {
    setPlayerStatus(player.status)

    const subscription = player.addListener("statusChange", ({ status, error }) => {
      setPlayerStatus(status)
      setPlayerError(error ?? null)
    })

    return () => {
      subscription.remove()
    }
  }, [player])

  useEffect(() => {
    if (videoUrl) {
      setPlayerStatus("loading")
      setPlayerError(null)
    }
  }, [videoUrl])

  const transcriptParagraphs = useMemo(
    () => extractParagraphs(videoContent?.transcript ?? slide?.transcript ?? null),
    [videoContent?.transcript, slide?.transcript]
  )

  const loading = Boolean(videoUrl) && (playerStatus === "idle" || playerStatus === "loading")
  const hasError = playerStatus === "error" || Boolean(playerError)

  return (
    <>
      <ThemedHeader overrideTitle={module.title || lesson.title} />
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

          {videoUrl ? (
            <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: "#0f172a" }}>
              <VideoView
                player={player}
                style={{ width: "100%", aspectRatio: 16 / 9 }}
                nativeControls
                contentFit="contain"
                allowsFullscreen
                allowsPictureInPicture
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
                    backgroundColor: "rgba(15,23,42,0.3)",
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

          {transcriptParagraphs.length > 0 ? (
            <View style={{ gap: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: "600", color: colorScheme === "dark" ? "#e2e8f0" : "#0f172a" }}>
                {t("lesson.video.transcript", { defaultValue: "Transcript" })}
              </Text>
              {transcriptParagraphs.map((paragraph, idx) => (
                <Text key={idx} style={{ fontSize: 16, lineHeight: 22, color: colorScheme === "dark" ? "#cbd5f5" : "#374151" }}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  )
}
