import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/lib/i18n";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeMode } from "../theme-context";

function LanguageHeaderTitle() {
  const { t } = useTranslation();
  const { colorScheme } = useThemeMode();
  return <Text style={{ fontWeight: "700", fontSize: 18, color: colorScheme === 'dark' ? '#fff' : '#18181b' }}>{t("settings.language")}</Text>;
}

export default function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;
  const { colorScheme } = useThemeMode();

  const languages = [
    { code: "system", label: t("settings.system") },
    { code: "en", label: "English" },
    { code: "zh", label: "中文" },
  ];

  const handleLanguageChange = async (code: string) => {
    if (code === "system") {
      const { getLocales } = await import("expo-localization");
      const systemLocale = getLocales()[0]?.languageCode || "en";
      const fallback = systemLocale.startsWith("zh") ? "zh" : "en";
      await changeLanguage(fallback);
    } else {
      await changeLanguage(code);
    }
  };

  return (
    <>
      <Stack.Screen options={{
        headerTitle: () => <LanguageHeaderTitle />,
        headerStyle: { backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff' },
        headerTintColor: colorScheme === 'dark' ? '#fff' : '#18181b',
      }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#f9fafb" }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", marginBottom: 16 }}>
          {t("settings.languageDescription")}
        </Text>
        <View style={{ gap: 0, borderRadius: 12, backgroundColor: colorScheme === 'dark' ? '#23232a' : "#fff", overflow: "hidden" }}>
          {languages.map((lang, index) => (
            <Pressable
              key={lang.code}
              onPress={() => handleLanguageChange(lang.code)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 16,
                paddingHorizontal: 16,
                backgroundColor: pressed ? (colorScheme === 'dark' ? '#312e81' : '#f3f4f6') : (colorScheme === 'dark' ? '#23232a' : '#fff'),
                borderBottomWidth: index < languages.length - 1 ? 1 : 0,
                borderBottomColor: colorScheme === 'dark' ? '#23232a' : '#e5e7eb',
              })}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: currentLang === lang.code ? "600" : "400",
                  color: currentLang === lang.code ? '#6366f1' : (colorScheme === 'dark' ? '#fff' : '#1f2937'),
                }}
              >
                {lang.label}
              </Text>
              {currentLang === lang.code && (
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
