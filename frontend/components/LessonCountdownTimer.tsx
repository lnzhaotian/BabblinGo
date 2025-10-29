import React from "react"
import { View, Text } from "react-native"
import { formatSecondsMMSS } from "@/hooks/useLearningSession"

export function LessonCountdownTimer({ remaining }: { remaining: number }) {
  return (
    <View style={{ position: "absolute", top: 8, left: 0, right: 0, alignItems: "center", zIndex: 10 }}>
      <View style={{ backgroundColor: "rgba(17,24,39,0.9)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 }}>
        <Text style={{ color: "#fff", fontVariant: ["tabular-nums"], fontWeight: "700" }}>{formatSecondsMMSS(remaining)}</Text>
      </View>
    </View>
  )
}
