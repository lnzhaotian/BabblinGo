import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { MaterialIcons } from "@expo/vector-icons"
import { Audio, AVPlaybackStatus, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av"
import { useLocalSearchParams, useRouter } from "expo-router"

import { extractModules, fetchLessonById, LessonDoc, MediaDoc, resolveMediaUrl } from "@/lib/payload"

type AudioTrack = {
  moduleId: string
  moduleIndex: number
  title: string
  displayOrder: string
  audioUrl: string
}

const SPEED_OPTIONS = [0.5, 0.7, 1.0, 1.2, 1.5, 1.7, 2.0] as const
type PlaybackRate = (typeof SPEED_OPTIONS)[number]

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

const formatMillis = (ms: number) => {
  if (!ms || ms < 0) {
    return "0:00"
  }

  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

const formatSpeedLabel = (speed: PlaybackRate) =>
  Number.isInteger(speed) ? `${speed.toFixed(0)}x` : `${speed.toFixed(1)}x`

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

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoopEnabled, setIsLoopEnabled] = useState(true)
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(1.0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoadingAudio, setIsLoadingAudio] = useState(false)
  const [positionMillis, setPositionMillis] = useState(0)
  const [durationMillis, setDurationMillis] = useState(0)
  const [hasAutoStarted, setHasAutoStarted] = useState(false)

  const soundRef = useRef<Audio.Sound | null>(null)
  const audioTracksRef = useRef<AudioTrack[]>([])
  const playTrackRef = useRef<((index: number, shouldPlay?: boolean) => Promise<void>) | null>(null)
  const isLoopEnabledRef = useRef(isLoopEnabled)

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
    isLoopEnabledRef.current = isLoopEnabled
  }, [isLoopEnabled])

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      playThroughEarpieceAndroid: false,
    }).catch((audioError) => {
      console.error("Failed to configure audio mode", audioError)
    })
  }, [])

  const modules = useMemo(() => (lesson ? extractModules(lesson) : []), [lesson])

  const audioTracks = useMemo(() => {
    return modules
      .map((module, index) => {
        const audioUrl = resolveMediaUrl(module.audio)
        if (!audioUrl) {
          return null
        }

        const displayOrder = formatOrder(module.order, index)
        const title = module.title ? `Module ${displayOrder}: ${module.title}` : `Module ${displayOrder}`

        return {
          moduleId: module.id,
          moduleIndex: index,
          title,
          displayOrder,
          audioUrl,
        }
      })
      .filter((track): track is AudioTrack => Boolean(track))
  }, [modules])

  useEffect(() => {
    audioTracksRef.current = audioTracks
  }, [audioTracks])

  const unloadCurrent = useCallback(async (resetState = true) => {
    const current = soundRef.current
    if (current) {
      try {
        current.setOnPlaybackStatusUpdate(null)
        await current.stopAsync()
      } catch {
        // sound may already be stopped
      }

      try {
        await current.unloadAsync()
      } catch (unloadError) {
        console.error("Failed to unload audio", unloadError)
      }

      soundRef.current = null
    }

    if (resetState) {
      setIsPlaying(false)
      setPositionMillis(0)
      setDurationMillis(0)
    }
  }, [])

  const playTrack = useCallback(
    async (index: number, shouldPlay = true) => {
      if (index < 0 || index >= audioTracks.length) {
        return
      }

      setIsLoadingAudio(true)

      try {
        const track = audioTracks[index]
        await unloadCurrent(false)

        const { sound } = await Audio.Sound.createAsync(
          { uri: track.audioUrl },
          { shouldPlay: false }
        )

        soundRef.current = sound

        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (!status.isLoaded) {
            if ("error" in status && status.error) {
              console.error("Audio playback error", status.error)
            }
            return
          }

          setPositionMillis(status.positionMillis ?? 0)
          setDurationMillis(status.durationMillis ?? status.playableDurationMillis ?? 0)
          setIsPlaying(status.isPlaying)

          if (status.didJustFinish) {
            const nextIndex = index + 1
            const runner = playTrackRef.current

            if (nextIndex < audioTracksRef.current.length && runner) {
              runner(nextIndex).catch((nextError) => {
                console.error("Failed to advance to next track", nextError)
              })
            } else if (isLoopEnabledRef.current && audioTracksRef.current.length > 0 && runner) {
              runner(0).catch((loopError) => {
                console.error("Failed to loop playback", loopError)
              })
            } else {
              setIsPlaying(false)
            }
          }
        })

        await sound.setRateAsync(playbackRate, true)

        if (shouldPlay) {
          await sound.playAsync()
          setIsPlaying(true)
          setHasAutoStarted(true)
        } else {
          setIsPlaying(false)
        }

        setCurrentIndex(index)
        setPositionMillis(0)
        setDurationMillis(0)
      } catch (playError) {
        console.error("Failed to play audio track", playError)
      } finally {
        setIsLoadingAudio(false)
      }
    },
    [audioTracks, playbackRate, unloadCurrent]
  )

  useEffect(() => {
    playTrackRef.current = playTrack
  }, [playTrack])

  useEffect(() => {
    if (audioTracks.length === 0) {
      setCurrentIndex(0)
      setHasAutoStarted(false)
      unloadCurrent().catch(() => {})
      return
    }

    if (currentIndex >= audioTracks.length) {
      setCurrentIndex(0)
    }

    if (!hasAutoStarted) {
      playTrack(0).catch((autoStartError) => {
        console.error("Failed to autoplay lesson audio", autoStartError)
      })
    }
  }, [audioTracks, currentIndex, hasAutoStarted, playTrack, unloadCurrent])

  useEffect(() => {
    return () => {
      unloadCurrent(false).catch(() => {})
    }
  }, [unloadCurrent])

  useEffect(() => {
    if (soundRef.current) {
      soundRef.current
        .setRateAsync(playbackRate, true)
        .catch((rateError) => console.error("Failed to update playback speed", rateError))
    }
  }, [playbackRate])

  const handlePlayPause = useCallback(async () => {
    if (audioTracks.length === 0) {
      return
    }

    const sound = soundRef.current
    const safeIndex = Math.min(currentIndex, Math.max(audioTracks.length - 1, 0))

    try {
      if (!sound) {
        await playTrack(safeIndex)
        return
      }

      const status = await sound.getStatusAsync()
      if (!status.isLoaded) {
        return
      }

      if (status.isPlaying) {
        await sound.pauseAsync()
        setIsPlaying(false)
      } else {
        await sound.playAsync()
        setIsPlaying(true)
      }
    } catch (toggleError) {
      console.error("Failed to toggle playback", toggleError)
    }
  }, [audioTracks.length, currentIndex, playTrack])

  const handleStop = useCallback(async () => {
    await unloadCurrent()
    setCurrentIndex(0)
    setHasAutoStarted(true)
  }, [unloadCurrent])

  const handleNext = useCallback(() => {
    if (audioTracks.length === 0) {
      return
    }

    const nextIndex = currentIndex + 1

    if (nextIndex < audioTracks.length) {
      playTrack(nextIndex).catch((nextError) => console.error("Failed to skip to next track", nextError))
    } else if (isLoopEnabledRef.current && audioTracks.length > 0) {
      playTrack(0).catch((loopError) => console.error("Failed to restart playlist", loopError))
    } else {
      handleStop().catch(() => {})
    }
  }, [audioTracks.length, currentIndex, playTrack, handleStop])

  const handlePrevious = useCallback(async () => {
    if (audioTracks.length === 0) {
      return
    }

    const sound = soundRef.current

    try {
      if (sound) {
        const status = await sound.getStatusAsync()

        if (status.isLoaded && (status.positionMillis ?? 0) > 3000) {
          await sound.setPositionAsync(0)
          setPositionMillis(0)
          return
        }
      }

      if (currentIndex > 0) {
        await playTrack(currentIndex - 1)
      } else if (isLoopEnabledRef.current && audioTracks.length > 1) {
        await playTrack(audioTracks.length - 1)
      } else if (sound) {
        await sound.setPositionAsync(0)
        setPositionMillis(0)
      }
    } catch (prevError) {
      console.error("Failed to skip to previous track", prevError)
    }
  }, [audioTracks.length, currentIndex, playTrack])

  const handleSpeedChange = useCallback((speed: PlaybackRate) => {
    setPlaybackRate(speed)
  }, [])

  const toggleLoop = useCallback(() => {
    setIsLoopEnabled((prev) => !prev)
  }, [])

  const modulesWithContent = modules
  const showAudioPlayer = audioTracks.length > 0
  const nowPlaying = audioTracks[currentIndex] ?? null
  const controlsDisabled = audioTracks.length === 0 || isLoadingAudio
  const canStop = audioTracks.length > 0 && (isPlaying || positionMillis > 0)
  const scrollPaddingBottom = showAudioPlayer ? 200 : 32

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

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: scrollPaddingBottom, gap: 24 }}
        >
          {modulesWithContent.length === 0 ? (
            <Text style={{ textAlign: "center", color: "#666" }}>No modules available for this lesson.</Text>
          ) : (
            modulesWithContent.map((module, index) => {
              const displayOrder = formatOrder(module.order, index)
              const paragraphs = extractParagraphs(module.body)
              const imageUrl = resolveMediaUrl(module.image)
              const imageAlt = isMediaDoc(module.image) ? module.image?.filename ?? module.title : module.title

              return (
                <View key={module.id} style={{ gap: 12 }}>

                  {imageUrl ? (
                    <Image
                      source={{ uri: imageUrl }}
                      accessibilityLabel={imageAlt || `Module ${displayOrder}`}
                      style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: "#f5f5f5" }}
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
              )
            })
          )}
        </ScrollView>
      </View>

      {showAudioPlayer ? (
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
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {isLoadingAudio ? <ActivityIndicator size="small" /> : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between"}}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                onPress={() => {
                  handlePrevious().catch(() => {})
                }}
                disabled={audioTracks.length === 0}
                hitSlop={10}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                  padding: 6,
                  marginRight: 6,
                })}
              >
                <MaterialIcons
                  name="skip-previous"
                  size={28}
                  color={audioTracks.length === 0 ? "#ccc" : "#333"}
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  handlePlayPause().catch(() => {})
                }}
                disabled={controlsDisabled}
                hitSlop={10}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                  padding: 6,
                  marginRight: 6,
                })}
              >
                <MaterialIcons
                  name={isPlaying ? "pause" : "play-arrow"}
                  size={32}
                  color={controlsDisabled ? "#ccc" : "#007aff"}
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  handleStop().catch(() => {})
                }}
                disabled={!canStop}
                hitSlop={10}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                  padding: 6,
                  marginRight: 6,
                })}
              >
                <MaterialIcons name="stop" size={28} color={canStop ? "#e53935" : "#ccc"} />
              </Pressable>

              <Pressable
                onPress={() => {
                  handleNext()
                }}
                disabled={audioTracks.length === 0 || (!isLoopEnabled && currentIndex >= audioTracks.length - 1)}
                hitSlop={10}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.6 : 1,
                  padding: 6,
                  marginRight: 6,
                })}
              >
                <MaterialIcons
                  name="skip-next"
                  size={28}
                  color={
                    audioTracks.length === 0 || (!isLoopEnabled && currentIndex >= audioTracks.length - 1)
                      ? "#ccc"
                      : "#333"
                  }
                />
              </Pressable>
            </View>

            <Pressable
              onPress={toggleLoop}
              hitSlop={10}
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                padding: 6,
              })}
            >
              <MaterialIcons name="loop" size={26} color={isLoopEnabled ? "#007aff" : "#666"} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", marginTop: 12 }}>
            {SPEED_OPTIONS.map((speed) => {
              const isActive = playbackRate === speed
              return (
                <Pressable
                  key={speed}
                  onPress={() => handleSpeedChange(speed)}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 16,
                    marginRight: 8,
                    marginBottom: 8,
                    backgroundColor: isActive ? "#007aff" : "#f1f1f3",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontSize: 13, fontWeight: "500", color: isActive ? "#fff" : "#333" }}>
                    {formatSpeedLabel(speed)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  )
}

export default LessonDetail

