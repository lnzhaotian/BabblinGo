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
        <Stack.Screen name="(stack)/web" options={{ headerShown: false }} />
        <Stack.Screen name="(stack)/lesson/[lessonId]" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
