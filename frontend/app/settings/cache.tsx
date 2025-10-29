import React from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCacheStats, clearCache } from "@/lib/cache-manager";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

export default function CacheSettings() {
  const { t } = useTranslation();
  const router = useRouter();
  const [cacheStats, setCacheStats] = React.useState<{ fileCount: number; totalSize: number } | null>(null);
  const [loadingCache, setLoadingCache] = React.useState(false);
  const [clearingCache, setClearingCache] = React.useState(false);

  const loadCacheStats = React.useCallback(async () => {
    setLoadingCache(true);
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (error) {
      console.error("Failed to load cache stats:", error);
    } finally {
      setLoadingCache(false);
    }
  }, []);

  React.useEffect(() => {
    loadCacheStats();
  }, [loadCacheStats]);

  // Reload cache stats when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadCacheStats();
    }, [loadCacheStats])
  );

  const handleClearCache = () => {
    Alert.alert(
      t("settings.cache.clearConfirmTitle") || "Clear Cache?",
      t("settings.cache.clearConfirmMessage") || "This will delete all cached media files. They will be re-downloaded when needed.",
      [
        { text: t("common.cancel") || "Cancel", style: "cancel" },
        {
          text: t("common.clear") || "Clear",
          style: "destructive",
          onPress: async () => {
            setClearingCache(true);
            try {
              await clearCache();
              await loadCacheStats();
              Alert.alert(
                t("settings.cache.cleared") || "Cache Cleared",
                t("settings.cache.clearedMessage") || "All cached files have been removed."
              );
            } catch (error) {
              console.error("Failed to clear cache:", error);
              Alert.alert(
                t("common.error") || "Error",
                t("settings.cache.clearError") || "Failed to clear cache. Please try again."
              );
            } finally {
              setClearingCache(false);
            }
          },
        },
      ]
    );
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{ padding: 8 }}
        >
          <MaterialIcons name="arrow-back" size={24} color="#1f2937" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937", marginLeft: 8 }}>
          {t("settings.cache.title")}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
          {t("settings.cache.description")}
        </Text>

        {loadingCache ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : (
          <>
            {/* Stats Card */}
            <View
              style={{
                backgroundColor: "#fff",
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialIcons name="storage" size={24} color="#6b7280" />
                  <Text style={{ fontSize: 16, color: "#1f2937", fontWeight: "600" }}>
                    {t("settings.cache.files") || "Files"}
                  </Text>
                </View>
                <Text style={{ fontSize: 20, color: "#1f2937", fontWeight: "700" }}>
                  {cacheStats?.fileCount || 0}
                </Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialIcons name="folder" size={24} color="#6b7280" />
                  <Text style={{ fontSize: 16, color: "#1f2937", fontWeight: "600" }}>
                    {t("settings.cache.size") || "Size"}
                  </Text>
                </View>
                <Text style={{ fontSize: 20, color: "#1f2937", fontWeight: "700" }}>
                  {formatBytes(cacheStats?.totalSize || 0)}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={loadCacheStats}
                disabled={loadingCache}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor: pressed ? "#eef2ff" : "#fff",
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                  gap: 8,
                })}
              >
                <MaterialIcons name="refresh" size={22} color="#6366f1" />
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#6366f1" }}>
                  {t("common.refresh") || "Refresh"}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleClearCache}
                disabled={clearingCache || (cacheStats?.fileCount || 0) === 0}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  backgroundColor:
                    clearingCache || (cacheStats?.fileCount || 0) === 0
                      ? "#f3f4f6"
                      : pressed
                      ? "#dc2626"
                      : "#ef4444",
                  gap: 8,
                })}
              >
                {clearingCache ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="delete" size={22} color="#fff" />
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
                      {t("common.clear") || "Clear"}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
