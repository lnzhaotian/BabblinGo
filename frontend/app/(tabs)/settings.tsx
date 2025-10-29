import React from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/lib/i18n";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCacheStats, clearCache } from "@/lib/cache-manager";
import { MaterialIcons } from "@expo/vector-icons";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const [cacheStats, setCacheStats] = React.useState<{ fileCount: number; totalSize: number } | null>(null);
  const [loadingCache, setLoadingCache] = React.useState(false);
  const [clearingCache, setClearingCache] = React.useState(false);

  const languages = [
    { code: "system", label: t("settings.system") },
    { code: "en", label: "English" },
    { code: "zh", label: "中文" },
  ];

  const handleLanguageChange = async (code: string) => {
    if (code === "system") {
      // Reload system locale
      const { getLocales } = await import("expo-localization");
      const systemLocale = getLocales()[0]?.languageCode || "en";
      const fallback = systemLocale.startsWith("zh") ? "zh" : "en";
      await changeLanguage(fallback);
    } else {
      await changeLanguage(code);
    }
  };

  // Load cache stats on mount and when screen is focused
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
              await loadCacheStats(); // Refresh stats
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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", marginBottom: 24 }}>{t("settings.title")}</Text>

        {/* Language Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 8 }}>{t("settings.language")}</Text>
          <Text style={{ color: "#6b7280", marginBottom: 12 }}>{t("settings.languageDescription")}</Text>
          <View style={{ gap: 8 }}>
            {languages.map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => handleLanguageChange(lang.code)}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: currentLang === lang.code ? "#eef2ff" : "#f3f4f6",
                  borderWidth: currentLang === lang.code ? 2 : 0,
                  borderColor: "#6366f1",
                }}
              >
                <Text style={{ fontWeight: currentLang === lang.code ? "700" : "400", color: currentLang === lang.code ? "#6366f1" : "#374151" }}>
                  {lang.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Cache Management Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 8 }}>
            {t("settings.cache.title") || "Media Cache"}
          </Text>
          <Text style={{ color: "#6b7280", marginBottom: 12 }}>
            {t("settings.cache.description") || "Cached media files for offline access"}
          </Text>

          {loadingCache ? (
            <View style={{ padding: 16, alignItems: "center" }}>
              <ActivityIndicator size="small" color="#6366f1" />
            </View>
          ) : (
            <View
              style={{
                padding: 16,
                borderRadius: 8,
                backgroundColor: "#f3f4f6",
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialIcons name="storage" size={20} color="#6b7280" />
                  <Text style={{ color: "#374151", fontWeight: "600" }}>
                    {t("settings.cache.files") || "Files"}
                  </Text>
                </View>
                <Text style={{ color: "#6b7280", fontWeight: "600" }}>{cacheStats?.fileCount || 0}</Text>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialIcons name="folder" size={20} color="#6b7280" />
                  <Text style={{ color: "#374151", fontWeight: "600" }}>
                    {t("settings.cache.size") || "Size"}
                  </Text>
                </View>
                <Text style={{ color: "#6b7280", fontWeight: "600" }}>
                  {formatBytes(cacheStats?.totalSize || 0)}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <Pressable
                  onPress={loadCacheStats}
                  disabled={loadingCache}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: "#fff",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <MaterialIcons name="refresh" size={18} color="#6366f1" />
                    <Text style={{ fontWeight: "600", color: "#6366f1" }}>
                      {t("common.refresh") || "Refresh"}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={handleClearCache}
                  disabled={clearingCache || (cacheStats?.fileCount || 0) === 0}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: clearingCache || (cacheStats?.fileCount || 0) === 0 ? "#f3f4f6" : "#ef4444",
                    alignItems: "center",
                  }}
                >
                  {clearingCache ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <MaterialIcons name="delete" size={18} color="#fff" />
                      <Text style={{ fontWeight: "600", color: "#fff" }}>
                        {t("common.clear") || "Clear"}
                      </Text>
                    </View>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Learning Records Link */}
        <Link href="/(tabs)/progress" asChild>
          <Pressable style={{ backgroundColor: "#6366f1", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: "center" }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>{t("settings.viewRecords")}</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  );
}
