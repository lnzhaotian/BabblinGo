import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/lib/i18n";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

export default function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

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
      <Stack.Screen options={{ title: t("settings.language") }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }} edges={["bottom"]}>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
          {t("settings.languageDescription")}
        </Text>

        <View style={{ gap: 0, borderRadius: 12, backgroundColor: "#fff", overflow: "hidden" }}>
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
                backgroundColor: pressed ? "#f3f4f6" : "#fff",
                borderBottomWidth: index < languages.length - 1 ? 1 : 0,
                borderBottomColor: "#e5e7eb",
              })}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: currentLang === lang.code ? "600" : "400",
                  color: currentLang === lang.code ? "#6366f1" : "#1f2937",
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
