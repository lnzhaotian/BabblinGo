import React from "react";
import { Tabs } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

export default function TabsLayout() {
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
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tabs.Screen name="index" options={{ title: "BabblinGo", tabBarLabel: "BabblinGo" }} />
      <Tabs.Screen name="tests" options={{ title: "测试", tabBarLabel: "测试" }} />
      <Tabs.Screen name="settings" options={{ title: "设置", tabBarLabel: "设置" }} />
    </Tabs>
  );
}
