import React, { useMemo } from "react"
import { Image, ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"

import { ThemedHeader } from "@/components/ThemedHeader"
import { LessonDoc, ModuleDoc, extractModuleSlides, resolveMediaUrl } from "@/lib/payload"
import { extractParagraphs } from "@/lib/lesson-helpers"
import { useThemeMode } from "@/app/theme-context"

export type RichPostModuleViewProps = {
  lesson: LessonDoc
  module: ModuleDoc
}

export const RichPostModuleView: React.FC<RichPostModuleViewProps> = ({
  lesson,
  module,
}) => {
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode()

  const slide = useMemo(() => {
    const slides = extractModuleSlides(module)
    return slides[0] ?? null
  }, [module])

  const paragraphs = useMemo(
    () => extractParagraphs(slide?.body ?? module.richPost?.body ?? null),
    [slide?.body, module.richPost?.body]
  )

  const gallery = module.richPost?.mediaGallery ?? slide?.richPost?.mediaGallery ?? []

  return (
    <>
      <ThemedHeader overrideTitle={module.title || lesson.title} />
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#fff" }}
        edges={["bottom"]}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 26, fontWeight: "700", color: colorScheme === "dark" ? "#e0e7ff" : "#111827" }}>
              {module.title}
            </Text>
            {module.summary ? (
              <Text style={{ fontSize: 16, color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>
                {module.summary}
              </Text>
            ) : null}
          </View>

          {paragraphs.length > 0 ? (
            <View style={{ gap: 16 }}>
              {paragraphs.map((paragraph, idx) => (
                <Text key={idx} style={{ fontSize: 17, lineHeight: 26, color: colorScheme === "dark" ? "#e2e8f0" : "#1f2937" }}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ) : (
            <View style={{ padding: 16, borderRadius: 12, backgroundColor: colorScheme === "dark" ? "#1e293b" : "#f1f5f9" }}>
              <Text style={{ color: colorScheme === "dark" ? "#94a3b8" : "#64748b" }}>
                {t("lesson.richPost.empty", { defaultValue: "No content has been added yet." })}
              </Text>
            </View>
          )}

          {gallery.length > 0 ? (
            <View style={{ gap: 16 }}>
              {gallery.map((entry) => {
                const mediaUrl = resolveMediaUrl(entry.media)
                if (!mediaUrl) {
                  return null
                }
                return (
                  <View key={entry.id ?? mediaUrl} style={{ gap: 8 }}>
                    <Image
                      source={{ uri: mediaUrl }}
                      style={{ width: "100%", aspectRatio: 3 / 2, borderRadius: 18, backgroundColor: "#1e293b" }}
                      resizeMode="cover"
                    />
                    {entry.caption ? (
                      <Text style={{ color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>{entry.caption}</Text>
                    ) : null}
                  </View>
                )
              })}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  )
}
