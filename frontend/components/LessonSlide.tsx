import React from "react"
import { View, Image, Text, ActivityIndicator, useColorScheme } from "react-native"
import { useTranslation } from "react-i18next"
import type { LessonModuleSlide } from "@/lib/payload"
import { extractParagraphs, formatOrder, isMediaDoc } from "@/lib/lesson-helpers"
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LessonSlideProps {
  item: LessonModuleSlide
  index: number
  screenWidth: number
  imageUrl: string | null
  cachedMedia: Record<string, string>
  downloadProgress: Record<string, number>
}

export const LessonSlide: React.FC<LessonSlideProps> = ({
  item,
  index,
  screenWidth,
  imageUrl,
  cachedMedia,
  downloadProgress,
}) => {
  const { t } = useTranslation()

  const displayOrder = formatOrder(item.order, index)
  const paragraphs = extractParagraphs(item.body)
  const imageAlt = isMediaDoc(item.image) ? item.image?.filename ?? item.title : item.title

  // Use cached image if available, otherwise use remote URL
  const displayImageUrl = imageUrl && cachedMedia[imageUrl] ? cachedMedia[imageUrl] : imageUrl
  const isDownloading = imageUrl && downloadProgress[imageUrl] !== undefined && downloadProgress[imageUrl] < 1

  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = React.useState<'system' | 'light' | 'dark'>('system');
  const colorScheme = themeMode === 'system' ? systemColorScheme : themeMode;
  React.useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('themeMode');
      if (stored === 'dark' || stored === 'light' || stored === 'system') {
        setThemeMode(stored);
      }
    })();
  }, []);

  return (
    <View
      style={{
        width: screenWidth,
        paddingHorizontal: 16,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colorScheme === 'dark' ? '#18181b' : undefined,
      }}
    >
      <View style={{ gap: 12, width: "100%", maxWidth: 600 }}>
        {displayImageUrl ? (
          <View style={{ position: "relative" }}>
            <Image
              source={{ uri: displayImageUrl }}
              accessibilityLabel={imageAlt || `Module ${displayOrder}`}
              style={{
                width: "100%",
                aspectRatio: 1,
                borderRadius: 12,
                backgroundColor: colorScheme === 'dark' ? '#23232a' : '#f5f5f5',
              }}
              resizeMode="cover"
            />
            {/* Show downloading indicator */}
            {isDownloading && (
              <View
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  backgroundColor: "rgba(0,0,0,0.7)",
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 6,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ActivityIndicator size="small" color="#fff" />
                <Text
                  style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}
                >
                  {t("lesson.downloading") || "Downloading..."}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {paragraphs.length > 0 ? (
          <View style={{ gap: 12 }}>
            {paragraphs.map((paragraph, paragraphIndex) => (
              <Text
                key={paragraphIndex}
                style={{
                  fontSize: 24,
                  lineHeight: 30,
                  fontWeight: "700",
                  textAlign: "center",
                  color: colorScheme === 'dark' ? '#fff' : '#333',
                }}
              >
                {paragraph}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}
