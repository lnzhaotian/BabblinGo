import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/lib/i18n"
import { ThemeProvider } from "./theme-context";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Stack>
          {/* (tabs) is a group that contains the bottom tabs. */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Auth screens */}
          <Stack.Screen
            name="auth/register"
            options={{
              headerShown: true,
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="auth/login"
            options={{
              headerShown: true,
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="auth/forgot"
            options={{
              headerShown: true,
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="settings/profile"
            options={{
              headerShown: true,
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          {/* Stack-only routes */}
          <Stack.Screen
            name="(stack)/web"
            options={{
              headerShown: true,
              headerBackButtonDisplayMode: "minimal",
            }}
          />
          <Stack.Screen
            name="(stack)/lesson/[lessonId]"
            options={{
              headerShown: true,
              headerBackButtonDisplayMode: "minimal",
            }}
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
            name="settings/theme"
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
    </ThemeProvider>
  );
}
