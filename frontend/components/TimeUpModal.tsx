import React from "react"
import { View, Text, Pressable, Modal } from "react-native"
import { useTranslation } from "react-i18next"

interface TimeUpModalProps {
  visible: boolean
  onClose: () => void
  onSetNew: () => void
  onEndSession: () => void
}

export const TimeUpModal: React.FC<TimeUpModalProps> = ({
  visible,
  onClose,
  onSetNew,
  onEndSession,
}) => {
  const { t } = useTranslation()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.3)",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 360,
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 16,
            gap: 12,
          }}
        >
          <Text
            style={{ fontSize: 18, fontWeight: "700", textAlign: "center" }}
          >
            {t("timer.timeUp")}
          </Text>
          <Text style={{ textAlign: "center", color: "#6b7280" }}>
            {t("timer.timeUpMessage")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 12,
              marginTop: 8,
            }}
          >
            <Pressable
              onPress={onSetNew}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: "#6366f1",
              }}
            >
              <Text style={{ fontWeight: "700", color: "#fff" }}>
                {t("timer.setNew")}
              </Text>
            </Pressable>
            <Pressable
              onPress={onEndSession}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: "#ef4444",
              }}
            >
              <Text style={{ fontWeight: "700", color: "#fff" }}>
                {t("timer.endSession")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
