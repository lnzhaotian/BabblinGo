
import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
// import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeMode } from "../theme-context";
import { ThemedHeader } from "../components/ThemedHeader";

// Replaced by ThemedHeader

export default function ThemeSettings() {
  const { t } = useTranslation();
  const { themeMode, setThemeMode, colorScheme } = useThemeMode();

  const themeOptions = [
    { code: "system", label: t("settings.themeSystem") },
    { code: "light", label: t("settings.themeLight") },
    { code: "dark", label: t("settings.themeDark") },
  ];

  return (
    <>
      <ThemedHeader titleKey="settings.theme" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#f9fafb" }} edges={["bottom"]}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", marginBottom: 16 }}>
            {t("settings.themeDescription")}
          </Text>
          <View style={{ gap: 0, borderRadius: 12, backgroundColor: colorScheme === 'dark' ? '#23232a' : "#fff", overflow: "hidden" }}>
            {themeOptions.map((option, index) => (
              <Pressable
                key={option.code}
                onPress={() => setThemeMode(option.code as 'system' | 'light' | 'dark')}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  backgroundColor: pressed ? (colorScheme === 'dark' ? '#312e81' : '#f3f4f6') : (colorScheme === 'dark' ? '#23232a' : '#fff'),
                  borderBottomWidth: index < themeOptions.length - 1 ? 1 : 0,
                  borderBottomColor: colorScheme === 'dark' ? '#23232a' : '#e5e7eb',
                })}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: themeMode === option.code ? "600" : "400",
                    color: themeMode === option.code ? '#6366f1' : (colorScheme === 'dark' ? '#fff' : '#1f2937'),
                  }}
                >
                  {option.label}
                </Text>
                {themeMode === option.code && (
                  <MaterialIcons name="check" size={24} color="#6366f1" />
                )}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
