import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack>
        {/* (tabs) is a group that contains the bottom tabs. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  {/* Keep web as a stack screen so it doesn't appear as a tab. Using a parentheses group (stack) keeps it out of tabs. */}
  <Stack.Screen name="(stack)/web" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
