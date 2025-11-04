import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native"
import { Image } from "expo-image"
import { SafeAreaView } from "react-native-safe-area-context"
import { VideoView, useVideoPlayer, type PlayerError, type VideoPlayerStatus, type ContentType } from "expo-video"
import { useTranslation } from "react-i18next"
import { MaterialIcons } from "@expo/vector-icons"

import { LessonDoc, ModuleDoc, extractModuleSlides, resolveMediaUrl } from "@/lib/payload"
import { extractParagraphs } from "@/lib/lesson-helpers"
import { useThemeMode } from "@/app/theme-context"
import { useLearningSession } from "@/hooks/useLearningSession"

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
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)

  useLearningSession(lesson.id, lesson.title, { enabled: false })

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

  const videoSource = useMemo(() => {
    if (!videoUrl) return null
    if (videoContent?.streamUrl) {
      const isHls = videoContent.streamUrl.toLowerCase().endsWith(".m3u8")
      const contentType: ContentType = isHls ? "hls" : "auto"
      return {
        uri: videoContent.streamUrl,
        contentType,
      }
    }

    return {
      uri: videoUrl,
      useCaching: true,
    }
  }, [videoUrl, videoContent?.streamUrl])

  const player = useVideoPlayer(videoSource, (instance) => {
    instance.loop = false
    instance.timeUpdateEventInterval = 0.5
  })

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

  setPlaybackRate(player.playbackRate)
    setIsPlaying(player.playing)

    return () => {
      statusSub.remove()
      playingSub.remove()
      rateSub.remove()
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
  const controlsDisabled = !videoUrl || hasError || loading

  const handleTogglePlay = useCallback(() => {
    if (controlsDisabled) return
    if (player.playing) {
      player.pause()
      return
    }
    player.play()
  }, [controlsDisabled, player])

  const handleStop = useCallback(() => {
    if (controlsDisabled) return
    player.pause()
    player.currentTime = 0
  }, [controlsDisabled, player])

  const handleSeek = useCallback((seconds: number) => {
    if (controlsDisabled) return
    player.seekBy(seconds)
  }, [controlsDisabled, player])

  const handleSetRate = useCallback((rate: number) => {
    if (!videoUrl || hasError) return
    player.playbackRate = rate
    setPlaybackRate(rate)
  }, [hasError, player, videoUrl])

  const speedPresets = useMemo(() => [0.75, 1, 1.25, 1.5, 2], [])

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#fff" }}
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
            </View>

            <View
              style={{
                borderRadius: 16,
                backgroundColor: colorScheme === "dark" ? "#111827" : "#f8fafc",
                padding: 16,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <ControlButton
                    icon="replay-10"
                    label={t("lesson.video.controls.rewind", { defaultValue: "Back 10s" })}
                    onPress={() => handleSeek(-10)}
                    disabled={controlsDisabled}
                  />
                  <ControlButton
                    icon={isPlaying ? "pause" : "play-arrow"}
                    label={isPlaying ? t("lesson.video.controls.pause", { defaultValue: "Pause" }) : t("lesson.video.controls.play", { defaultValue: "Play" })}
                    onPress={handleTogglePlay}
                    disabled={controlsDisabled}
                  />
                  <ControlButton
                    icon="stop"
                    label={t("lesson.video.controls.stop", { defaultValue: "Stop" })}
                    onPress={handleStop}
                    disabled={controlsDisabled}
                  />
                  <ControlButton
                    icon="forward-10"
                    label={t("lesson.video.controls.forward", { defaultValue: "Forward 10s" })}
                    onPress={() => handleSeek(10)}
                    disabled={controlsDisabled}
                  />
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ color: colorScheme === "dark" ? "#e2e8f0" : "#1f2937", fontWeight: "600", fontSize: 14 }}>
                  {t("lesson.video.controls.speed", { defaultValue: "Speed" })}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {speedPresets.map((rate) => {
                    const isSelected = Math.abs(rate - playbackRate) < 0.05
                    const formattedValue = Number.isInteger(rate)
                      ? String(rate)
                      : rate % 0.5 === 0
                        ? rate.toFixed(1)
                        : rate.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
                    return (
                      <Pressable
                        key={`video-speed-${rate}`}
                        onPress={() => handleSetRate(rate)}
                        disabled={controlsDisabled}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 999,
                          backgroundColor: isSelected
                            ? colorScheme === "dark" ? "#4338ca" : "#4f46e5"
                            : colorScheme === "dark" ? "#1f2937" : "#e2e8f0",
                          opacity: controlsDisabled && !isSelected ? 0.6 : 1,
                        }}
                      >
                        <Text
                          style={{
                            color: isSelected ? "#fff" : colorScheme === "dark" ? "#c7d2fe" : "#3730a3",
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
  )
}

type ControlButtonProps = {
  icon: React.ComponentProps<typeof MaterialIcons>["name"]
  label: string
  onPress: () => void
  disabled?: boolean
}

const ControlButton: React.FC<ControlButtonProps> = ({ icon, label, onPress, disabled }) => {
  const { colorScheme } = useThemeMode()

  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: colorScheme === "dark" ? "#1f2937" : "#e2e8f0",
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <MaterialIcons
        name={icon}
        size={22}
        color={colorScheme === "dark" ? "#f8fafc" : "#1f2937"}
      />
      <Text style={{ color: colorScheme === "dark" ? "#e2e8f0" : "#1f2937", fontWeight: "600" }}>{label}</Text>
    </Pressable>
  )
}
