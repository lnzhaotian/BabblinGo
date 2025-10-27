import React, { useCallback, useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { MaterialIcons } from "@expo/vector-icons"
import { useLocalSearchParams, useRouter } from "expo-router"

import { extractModules, fetchLessonById, LessonDoc, MediaDoc, resolveMediaUrl } from "@/lib/payload"

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
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
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

      <ScrollView contentContainerStyle={{ padding: 16, gap: 24 }}>
        {modules.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#666" }}>No modules available for this lesson.</Text>
        ) : (
          modules.map((module, index) => {
            // const displayOrder = formatOrder(module.order, index)
            const paragraphs = extractParagraphs(module.body)
            const imageUrl = resolveMediaUrl(module.image)
            const imageAlt = isMediaDoc(module.image) ? module.image?.filename ?? module.title : module.title

            return (
              <View key={module.id} style={{ gap: 12 }}>
                {/* <Text style={{ fontSize: 16, fontWeight: "700" }}>{`Module ${displayOrder}`}</Text>
                <Text style={{ fontSize: 20, fontWeight: "700" }}>{module.title}</Text> */}

                {imageUrl ? (
                  <Image
                    source={{ uri: imageUrl }}
                    accessibilityLabel={imageAlt + index}
                    style={{ width: "100%", height: 200, borderRadius: 12, backgroundColor: "#f5f5f5" }}
                    resizeMode="cover"
                  />
                ) : null}

                {paragraphs.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    {paragraphs.map((paragraph, paragraphIndex) => (
                      <Text key={paragraphIndex} style={{ fontSize: 24, fontWeight: "700", lineHeight: 30, textAlign: "center", color: "#333" }}>
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
    </SafeAreaView>
  )
}

export default LessonDetail
