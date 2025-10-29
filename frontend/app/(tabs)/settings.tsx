import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { changeLanguage } from "@/lib/i18n";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.language;

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
