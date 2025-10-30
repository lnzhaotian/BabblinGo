import React, { useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useFocusEffect, Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
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

  useFocusEffect(
    React.useCallback(() => {
      const checkAuth = async () => {
        const token = await AsyncStorage.getItem('jwt');
        setIsAuthenticated(!!token);
      };
      checkAuth();
    }, [])
  );

  const handleLogout = async () => {
    await AsyncStorage.removeItem('jwt');
    // Optionally clear user info
    await AsyncStorage.removeItem('user_email');
    await AsyncStorage.removeItem('user_displayName');
    setIsAuthenticated(false);
    // Stay on settings tab after logout
  };

  const settingsItems: SettingItem[] = [
    // Profile (only if authenticated)
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
      id: "about",
      icon: "info" as keyof typeof MaterialIcons.glyphMap,
      iconColor: "#8b5cf6",
      titleKey: "settings.about",
      route: "/settings/about",
      showChevron: true,
    },
    // Authentication actions
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

    // Special handling for login button
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
            }]}
          >
            <MaterialIcons name={item.icon} size={24} color="#fff" style={{ marginRight: 10 }} />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{title}</Text>
          </Pressable>
        </View>
      );
    }

    // Special handling for logout button
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
            }]}
          >
            <MaterialIcons name={item.icon} size={24} color="#fff" style={{ marginRight: 10 }} />
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>{title}</Text>
          </Pressable>
        </View>
      );
    }

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
        }]}
      >
        <MaterialIcons name={item.icon} size={28} color={item.iconColor} style={{ marginRight: 18 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "500" }}>{title}</Text>
          {description && <Text style={{ color: "#6b7280", marginTop: 2 }}>{description}</Text>}
        </View>
        {item.showChevron && (
          <MaterialIcons name="chevron-right" size={24} color="#d1d5db" />
        )}
      </Pressable>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: t("settings.title") }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }} edges={["bottom"]}>
        <ScrollView>
          {settingsItems.map(renderSettingItem)}
          {/* Render login button at the bottom if not authenticated */}
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
