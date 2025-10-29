import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

type SettingItem = {
  id: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  titleKey: string;
  descriptionKey?: string;
  route: string;
  showChevron?: boolean;
};

export default function Settings() {
  const { t } = useTranslation();
  const router = useRouter();

  const settingsItems: SettingItem[] = [
    {
      id: "language",
      icon: "language",
      iconColor: "#6366f1",
      titleKey: "settings.language",
      descriptionKey: "settings.languageDescription",
      route: "/settings/language",
      showChevron: true,
    },
    {
      id: "cache",
      icon: "cloud-queue",
      iconColor: "#10b981",
      titleKey: "settings.cache.title",
      descriptionKey: "settings.cache.description",
      route: "/settings/cache",
      showChevron: true,
    },
    {
      id: "progress",
      icon: "trending-up",
      iconColor: "#f59e0b",
      titleKey: "settings.viewRecords",
      route: "/(tabs)/progress",
      showChevron: true,
    },
    {
      id: "about",
      icon: "info",
      iconColor: "#8b5cf6",
      titleKey: "settings.about",
      route: "/settings/about",
      showChevron: true,
    },
  ];

  const renderSettingItem = (item: SettingItem) => {
    const title = t(item.titleKey);
    const description = item.descriptionKey ? t(item.descriptionKey) : undefined;

    return (
      <Pressable
        key={item.id}
        onPress={() => router.push(item.route as any)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 16,
          paddingHorizontal: 16,
          backgroundColor: pressed ? "#f3f4f6" : "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#e5e7eb",
        })}
      >
        {/* Icon */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: `${item.iconColor}15`,
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}
        >
          <MaterialIcons name={item.icon} size={20} color={item.iconColor} />
        </View>

        {/* Text content */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#1f2937" }}>{title}</Text>
          {description && (
            <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{description}</Text>
          )}
        </View>

        {/* Chevron */}
        {item.showChevron && <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />}
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }} edges={["top"]}>
      <View style={{ padding: 16, paddingTop: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: "#1f2937" }}>{t("settings.title")}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 8 }}>
        {settingsItems.map(renderSettingItem)}
      </ScrollView>
    </SafeAreaView>
  );
}
