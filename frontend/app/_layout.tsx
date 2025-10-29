import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/lib/i18n"

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack>
        {/* (tabs) is a group that contains the bottom tabs. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* Stack-only routes */}
        <Stack.Screen
          name="(stack)/web"
          options={{ headerShown: true, headerBackButtonDisplayMode: "minimal" }}
        />
        <Stack.Screen
          name="(stack)/lesson/[lessonId]"
          options={{ headerShown: true, headerBackButtonDisplayMode: "minimal" }}
        />
        {/* Settings detail pages */}
        <Stack.Screen
          name="settings/language"
          options={{
            headerShown: true,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen 
          name="settings/learning" 
          options={{ 
            headerShown: true,
            headerBackButtonDisplayMode: "minimal",
            title: "Learning Preferences"
          }} 
        />
        <Stack.Screen
          name="settings/cache"
          options={{
            headerShown: true,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
        <Stack.Screen
          name="settings/about"
          options={{
            headerShown: true,
            headerBackButtonDisplayMode: "minimal",
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
