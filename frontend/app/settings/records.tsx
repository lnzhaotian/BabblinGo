import React from "react";
import { View, Text, Pressable, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useThemeMode } from "../theme-context";
import { ThemedHeader } from "@/components/ThemedHeader";
import { LEARNING_SESSIONS_STORAGE_KEY } from "@/lib/learning-types";
import type { SessionRecord } from "@/lib/learning-types";

export default function RecordsSettings() {
  const { t } = useTranslation();
  const [recordsStats, setRecordsStats] = React.useState<{ count: number; totalMinutes: number } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const { colorScheme } = useThemeMode();

  const loadRecordsStats = React.useCallback(async () => {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(LEARNING_SESSIONS_STORAGE_KEY);
      const sessions: SessionRecord[] = raw ? JSON.parse(raw) : [];
      
      const totalSeconds = sessions.reduce((sum, session) => {
        const duration = session.durationSeconds ?? Math.max(0, Math.round((session.endedAt - session.startedAt) / 1000));
        return sum + duration;
      }, 0);
      
      setRecordsStats({
        count: sessions.length,
        totalMinutes: Math.round(totalSeconds / 60)
      });
    } catch (error) {
      console.error("Failed to load learning records stats:", error);
      setRecordsStats({ count: 0, totalMinutes: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadRecordsStats();
  }, [loadRecordsStats]);

  useFocusEffect(
    React.useCallback(() => {
      loadRecordsStats();
    }, [loadRecordsStats])
  );

  const handleClearRecords = () => {
    Alert.alert(
      t("settings.records.clearConfirmTitle"),
      t("settings.records.clearConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.clear"),
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            try {
              await AsyncStorage.removeItem(LEARNING_SESSIONS_STORAGE_KEY);
              await loadRecordsStats();
              Alert.alert(
                t("settings.records.cleared"),
                t("settings.records.clearedMessage")
              );
            } catch (error) {
              console.error("Failed to clear learning records:", error);
              Alert.alert(
                t("common.error"),
                t("settings.records.clearError")
              );
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const formatTime = (minutes: number): string => {
    if (minutes === 0) return "0m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <>
      <ThemedHeader titleKey="settings.records.title" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#f9fafb" }} edges={["bottom"]}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", marginBottom: 16 }}>
            {t("settings.records.description")}
          </Text>
          {loading ? (
            <View style={{ padding: 32, alignItems: "center" }}>
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          ) : (
            <>
              {/* Stats Card */}
              <View
                style={{
                  backgroundColor: colorScheme === 'dark' ? '#23232a' : "#fff",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <MaterialIcons name="history" size={24} color={colorScheme === 'dark' ? '#d1d5db' : "#6b7280"} />
                    <Text style={{ fontSize: 16, color: colorScheme === 'dark' ? '#fff' : "#1f2937", fontWeight: "600" }}>
                      {t("settings.records.sessions")}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20, color: colorScheme === 'dark' ? '#fff' : "#1f2937", fontWeight: "700" }}>
                    {recordsStats?.count || 0}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <MaterialIcons name="schedule" size={24} color={colorScheme === 'dark' ? '#d1d5db' : "#6b7280"} />
                    <Text style={{ fontSize: 16, color: colorScheme === 'dark' ? '#fff' : "#1f2937", fontWeight: "600" }}>
                      {t("settings.records.totalTime")}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 20, color: colorScheme === 'dark' ? '#fff' : "#1f2937", fontWeight: "700" }}>
                    {formatTime(recordsStats?.totalMinutes || 0)}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <View style={{ gap: 12 }}>
                <Pressable
                  onPress={loadRecordsStats}
                  disabled={loading}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor: pressed ? (colorScheme === 'dark' ? '#312e81' : '#eef2ff') : (colorScheme === 'dark' ? '#23232a' : '#fff'),
                    borderWidth: 1,
                    borderColor: colorScheme === 'dark' ? '#23232a' : '#e5e7eb',
                    gap: 8,
                  })}
                >
                  <MaterialIcons name="refresh" size={22} color="#6366f1" />
                  <Text style={{ fontSize: 16, fontWeight: "600", color: '#6366f1' }}>
                    {t("common.refresh")}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleClearRecords}
                  disabled={clearing || (recordsStats?.count || 0) === 0}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    backgroundColor:
                      clearing || (recordsStats?.count || 0) === 0
                        ? (colorScheme === 'dark' ? '#23232a' : '#f3f4f6')
                        : pressed
                        ? (colorScheme === 'dark' ? '#dc2626' : '#dc2626')
                        : (colorScheme === 'dark' ? '#ef4444' : '#ef4444'),
                    gap: 8,
                  })}
                >
                  {clearing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="delete" size={22} color="#fff" />
                      <Text style={{ fontSize: 16, fontWeight: "600", color: '#fff' }}>
                        {t("common.clear")}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>

              {/* Warning */}
              <View style={{ 
                marginTop: 16, 
                padding: 12, 
                backgroundColor: colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colorScheme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : '#fecaca'
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <MaterialIcons name="warning" size={20} color="#ef4444" style={{ marginTop: 2 }} />
                  <Text style={{ 
                    flex: 1, 
                    fontSize: 13, 
                    color: colorScheme === 'dark' ? '#fca5a5' : '#991b1b',
                    lineHeight: 18
                  }}>
                    {t("settings.records.warning")}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
