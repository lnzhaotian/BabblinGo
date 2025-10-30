import React from "react";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useThemeMode } from "../theme-context";

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colorScheme } = useThemeMode();

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={({ route }) => ({
        headerShown: true,
        headerBackButtonDisplayMode: "minimal",
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff',
        },
        headerTitleStyle: {
          color: colorScheme === 'dark' ? '#fff' : '#18181b',
        },
        headerTintColor: colorScheme === 'dark' ? '#fff' : '#18181b',
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff',
          borderTopColor: colorScheme === 'dark' ? '#23232a' : '#eee',
        },
        tabBarActiveTintColor: colorScheme === 'dark' ? '#6366f1' : '#18181b',
        tabBarInactiveTintColor: colorScheme === 'dark' ? '#a1a1aa' : '#6b7280',
        tabBarIcon: ({ color, size }) => {
          let iconName: React.ComponentProps<typeof MaterialIcons>["name"] =
            "home";

          if (route.name === "index") {
            iconName = "auto-stories";
          } else if (route.name === "tests") {
            iconName = "task-alt";
          } else if (route.name === "settings") {
            iconName = "settings";
          } else if (route.name === "progress") {
            iconName = "insights";
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        }
      })}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), tabBarLabel: t("tabs.home") }} />
      <Tabs.Screen name="tests" options={{ title: t("tabs.tests"), tabBarLabel: t("tabs.tests") }} />
      <Tabs.Screen name="progress" options={{ title: t("tabs.progress"), tabBarLabel: t("tabs.progress") }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings"), tabBarLabel: t("tabs.settings") }} />
    </Tabs>
  );
}
