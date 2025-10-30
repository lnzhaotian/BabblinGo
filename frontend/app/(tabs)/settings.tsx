import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeMode } from "../theme-context";
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { colorScheme } = useThemeMode();



  const handleLogout = async () => {
    await AsyncStorage.removeItem('jwt');
    await AsyncStorage.removeItem('user_email');
    await AsyncStorage.removeItem('user_displayName');
    setIsAuthenticated(false);
  };



  const settingsItems: SettingItem[] = [
    ...(
      isAuthenticated
        ? [
            {
              id: "profile",
              icon: "person" as keyof typeof MaterialIcons.glyphMap,
              iconColor: "#6366f1",
              titleKey: "profile.title",
              route: "/settings/profile",
              showChevron: true,
            },
          ]
        : []
    ),
    {
      id: "language",
      icon: "language" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#6366f1",
      titleKey: "settings.language",
      descriptionKey: "settings.languageDescription",
      route: "/settings/language",
      showChevron: true,
    },
    {
      id: "learning",
      icon: "school" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#3b82f6",
      titleKey: "settings.learningPreferences",
      descriptionKey: "settings.learningPreferencesDescription",
      route: "/settings/learning",
      showChevron: true,
    },
    {
      id: "cache",
      icon: "cloud-queue" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#10b981",
      titleKey: "settings.cache.title",
      descriptionKey: "settings.cache.description",
      route: "/settings/cache",
      showChevron: true,
    },
    {
      id: "progress",
      icon: "trending-up" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#f59e0b",
      titleKey: "settings.viewRecords",
      route: "/(tabs)/progress",
      showChevron: true,
    },
    {
      id: "theme",
      icon: "dark-mode" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#6366f1",
      titleKey: "settings.theme",
      descriptionKey: "settings.themeDescription",
      route: "/settings/theme",
      showChevron: true,
    },
    {
      id: "about",
      icon: "info" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#8b5cf6",
      titleKey: "settings.about",
      route: "/settings/about",
      showChevron: true,
    },
    ...(!isAuthenticated ? [] : [
      {
        id: "logout",
        icon: "logout" as keyof typeof MaterialIcons.glyphMap,
        iconColor: "#ef4444",
        titleKey: "settings.logout",
        route: "",
        showChevron: false,
      },
    ]),
  ];

  const renderSettingItem = (item: SettingItem) => {
    const title = t(item.titleKey);
    const description = item.descriptionKey ? t(item.descriptionKey) : undefined;

    if (!isAuthenticated && item.id === 'login') {
      return (
        <View key={item.id} style={{ padding: 18 }}>
          <Pressable
            onPress={() => router.push({ pathname: '/auth/login', params: {}, presentation: 'modal' } as any)}
            style={({ pressed }) => [{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? "#6366f1" : "#4f46e5",
              borderRadius: 8,
              paddingVertical: 14,
              paddingHorizontal: 24,
              marginHorizontal: 24,
              marginBottom: 8,
            }, colorScheme === 'dark' && { backgroundColor: pressed ? '#6366f1' : '#312e81' }]}
          >
            <MaterialIcons name={item.icon} size={24} color="#fff" style={{ marginRight: 10 }} />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{title}</Text>
          </Pressable>
        </View>
      );
    }

    if (item.id === 'logout') {
      return (
        <View key={item.id} style={{ padding: 18 }}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? "#ef4444" : "#dc2626",
              borderRadius: 8,
              paddingVertical: 14,
              paddingHorizontal: 24,
              marginHorizontal: 24,
              marginBottom: 8,
            }, colorScheme === 'dark' && { backgroundColor: pressed ? '#ef4444' : '#7f1d1d' }]}
          >
            <MaterialIcons name={item.icon} size={24} color="#fff" style={{ marginRight: 10 }} />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{title}</Text>
          </Pressable>
        </View>
      );
    }

    // Theme item now navigates to dedicated theme settings page

    return (
      <Pressable
        key={item.id}
        onPress={() => item.route && router.push(item.route as never)}
        style={({ pressed }) => [{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 18,
          paddingHorizontal: 16,
          backgroundColor: pressed ? "#f3f4f6" : "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }, colorScheme === 'dark' && {
          backgroundColor: pressed ? '#23232a' : '#18181b',
          borderBottomColor: '#23232a',
        }]}
      >
        <MaterialIcons name={item.icon} size={28} color={item.iconColor} style={{ marginRight: 18 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "500", color: colorScheme === 'dark' ? '#fff' : undefined }}>{title}</Text>
          {description && <Text style={{ color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", marginTop: 2 }}>{description}</Text>}
        </View>
        {item.showChevron && (
          <MaterialIcons name="chevron-right" size={24} color={colorScheme === 'dark' ? '#a1a1aa' : "#d1d5db"} />
        )}
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t("settings.title") }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#f9fafb" }} edges={["bottom"]}>
        <ScrollView>
          {settingsItems.map(renderSettingItem)}
          {!isAuthenticated && renderSettingItem({
            id: "login",
            icon: "login" as keyof typeof MaterialIcons.glyphMap,
            iconColor: "#6366f1",
            titleKey: "settings.login",
            route: "/auth/login",
            showChevron: false,
          })}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}
