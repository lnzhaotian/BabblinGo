import React from "react"
import { View, Text, Pressable, Modal } from "react-native"
import { MaterialIcons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import type { LessonCacheStatus } from "@/lib/cache-manager"

interface CacheMenuModalProps {
  visible: boolean
  onClose: () => void
  cacheStatus: LessonCacheStatus
  onRedownload: () => void
  onClear: () => void
}

export const CacheMenuModal: React.FC<CacheMenuModalProps> = ({
  visible,
  onClose,
  cacheStatus,
  onRedownload,
  onClear,
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
            {t("lesson.cache.title") || "Cache Management"}
          </Text>

          {/* Cache status display */}
          <View
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              backgroundColor: "#f3f4f6",
              borderRadius: 8,
              gap: 8,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#6b7280", fontWeight: "600" }}>
                {t("lesson.cache.status") || "Status"}
              </Text>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <MaterialIcons
                  name={
                    cacheStatus === "full"
                      ? "check-circle"
                      : cacheStatus === "partial"
                        ? "cloud-download"
                        : "cloud-queue"
                  }
                  size={18}
                  color={
                    cacheStatus === "full"
                      ? "#10b981"
                      : cacheStatus === "partial"
                        ? "#f59e0b"
                        : "#9ca3af"
                  }
                />
                <Text style={{ color: "#374151", fontWeight: "600" }}>
                  {cacheStatus === "full"
                    ? t("lesson.cache.statusFull") || "Fully Cached"
                    : cacheStatus === "partial"
                      ? t("lesson.cache.statusPartial") || "Partially Cached"
                      : t("lesson.cache.statusNone") || "Not Cached"}
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={{ gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={onRedownload}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: "#3b82f6",
                alignItems: "center",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <MaterialIcons name="refresh" size={20} color="#fff" />
                <Text style={{ fontWeight: "700", color: "#fff" }}>
                  {t("lesson.cache.redownload") || "Re-download All"}
                </Text>
              </View>
            </Pressable>

            {cacheStatus !== "none" && (
              <Pressable
                onPress={onClear}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: "#ef4444",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <MaterialIcons name="delete" size={20} color="#fff" />
                  <Text style={{ fontWeight: "700", color: "#fff" }}>
                    {t("common.clear") || "Clear Cache"}
                  </Text>
                </View>
              </Pressable>
            )}

            <Pressable
              onPress={onClose}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 8,
                backgroundColor: "#e5e7eb",
                alignItems: "center",
              }}
            >
              <Text style={{ fontWeight: "600", color: "#374151" }}>
                {t("common.cancel") || "Cancel"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
