import React from "react";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

export default function TabsLayout() {
  const { t } = useTranslation();
  
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          let iconName: React.ComponentProps<typeof MaterialIcons>["name"] =
            "home";

          if (route.name === "index") {
            iconName = "language";
          } else if (route.name === "tests") {
            iconName = "quiz";
          } else if (route.name === "settings") {
            iconName = "settings";
          } else if (route.name === "progress") {
            iconName = "insights";
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        }}
      )}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home"), tabBarLabel: t("tabs.home") }} />
      <Tabs.Screen name="tests" options={{ title: t("tabs.tests"), tabBarLabel: t("tabs.tests") }} />
      <Tabs.Screen name="progress" options={{ title: t("tabs.progress"), tabBarLabel: t("tabs.progress") }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings"), tabBarLabel: t("tabs.settings") }} />
    </Tabs>
  );
}
