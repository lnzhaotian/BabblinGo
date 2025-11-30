import React from "react"
import { View, Text } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { WebView } from "react-native-webview"
import { useTranslation } from "react-i18next"

import { LessonDoc, ModuleDoc } from "@/lib/payload"
import { useThemeMode } from "@/app/theme-context"
import { useLearningSession } from "@/hooks/useLearningSession"
import { ThemedHeader } from "@/components/ThemedHeader"

export type WebPageModuleViewProps = {
  lesson: LessonDoc
  module: ModuleDoc
}

export const WebPageModuleView: React.FC<WebPageModuleViewProps> = ({
  lesson,
  module,
}) => {
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode()

  useLearningSession(lesson.id, lesson.title, {
    enabled: false,
    courseId: typeof lesson.course === 'string' ? lesson.course : lesson.course.id,
    defaultTrackingEnabled: typeof lesson.course === 'object' ? (lesson.course.defaultTrackingEnabled ?? undefined) : undefined,
  })

  const url = module.webPage?.url

  if (!url) {
    return (
      <>
        <ThemedHeader overrideTitle={module.title} />
        <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colorScheme === "dark" ? "#18181b" : "#fff" }}>
          <Text style={{ color: colorScheme === "dark" ? "#fff" : "#000" }}>
            {t("lesson.webPage.noUrl", { defaultValue: "No URL provided for this module." })}
          </Text>
        </SafeAreaView>
      </>
    )
  }

  return (
    <>
      <ThemedHeader overrideTitle={module.title} />
      <View style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#18181b" : "#fff" }}>
        <WebView
          source={{ uri: url }}
          style={{ flex: 1 }}
          startInLoadingState
        />
      </View>
    </>
  )
}
