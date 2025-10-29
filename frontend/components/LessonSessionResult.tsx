import React from "react"
import { View, Text, Pressable } from "react-native"
import { useTranslation } from "react-i18next"
import { formatSecondsMMSS } from "@/hooks/useLearningSession"

type Props = {
  elapsedSec: number
  plannedSec: number
  onExit: () => void
  onRestart: () => void
}

export function LessonSessionResult({ elapsedSec, plannedSec, onExit, onRestart }: Props) {
  const { t } = useTranslation()
  return (
    <View style={{ flex: 1, backgroundColor: "#fff", paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32, justifyContent: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "700", color: "#111", textAlign: "center", marginBottom: 16 }}>
        {t("lesson.sessionComplete") || "Session complete"}
      </Text>
      <View style={{ gap: 12, alignSelf: "center", width: "100%", maxWidth: 420 }}>
        <View style={{ backgroundColor: "#f3f4f6", padding: 16, borderRadius: 12, alignItems: "center" }}>
          <Text style={{ color: "#374151", fontWeight: "600", marginBottom: 4 }}>
            {t("lesson.timeSpent") || "Time spent"}
          </Text>
          <Text style={{ color: "#111827", fontVariant: ["tabular-nums"], fontSize: 20, fontWeight: "800" }}>{formatSecondsMMSS(elapsedSec)}</Text>
          <Text style={{ color: "#6b7280", marginTop: 4 }}>
            {t("lesson.sessionTarget") || "Session target"} {formatSecondsMMSS(plannedSec)}
          </Text>
        </View>
        <Pressable onPress={onRestart} style={({ pressed }) => ({ marginTop: 16, backgroundColor: "#10b981", paddingVertical: 14, borderRadius: 10, opacity: pressed ? 0.9 : 1 })}>
          <Text style={{ color: "#fff", textAlign: "center", fontSize: 16, fontWeight: "700" }}>
            {t("lesson.startAnother") || "Start another session"}
          </Text>
        </Pressable>
        <Pressable onPress={onExit} style={({ pressed }) => ({ backgroundColor: "#e5e7eb", paddingVertical: 12, borderRadius: 10, opacity: pressed ? 0.9 : 1 })}>
          <Text style={{ color: "#111827", textAlign: "center", fontSize: 16, fontWeight: "600" }}>
            {t("common.exit") || "Exit"}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
