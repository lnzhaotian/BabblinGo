import React from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import i18n from "@/lib/i18n";
import { ThemeProvider, useThemeMode } from "./theme-context";
import * as SplashScreen from "expo-splash-screen";
import { scheduleLearningRecordSync } from "../lib/learning-sync";
import { setAudioModeAsync } from "expo-audio";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppNavigator() {
  const { hydrated } = useThemeMode();
  const [i18nReady, setI18nReady] = React.useState<boolean>(i18n.isInitialized);

  React.useEffect(() => {
    if (i18n.isInitialized) {
      setI18nReady(true);
      return;
    }
    const onInit = () => setI18nReady(true);
    i18n.on('initialized', onInit);
    return () => {
      i18n.off('initialized', onInit);
    };
  }, []);

  React.useEffect(() => {
    if (hydrated && i18nReady) {
      // Small delay to ensure first themed frame is committed before hiding
      setTimeout(() => {
        SplashScreen.hideAsync().catch(() => {});
      }, 0);

      scheduleLearningRecordSync().catch(() => {
        // Logged within scheduler
      });
    }
  }, [hydrated, i18nReady]);

  // Pre-warm audio mode once at app start so first playback isn't penalized.
  React.useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
      } catch {
        // Non-fatal; component-level fallback remains
      }
    })();
  }, []);

  return (
    <Stack>
      {/* (tabs) is a group that contains the bottom tabs. */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* Auth screens - presented as modals */}
      <Stack.Screen
        name="auth/register"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="auth/login"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="auth/forgot"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="settings/profile"
        options={{
          headerShown: false,
        }}
      />
      {/* Stack-only routes */}
      <Stack.Screen
        name="(stack)/web"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(stack)/lesson/[lessonId]/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(stack)/lesson/[lessonId]/module/[moduleId]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(stack)/course/[courseId]"
        options={{
          headerShown: false,
        }}
      />
      {/* Settings detail pages */}
      <Stack.Screen
        name="settings/language"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="settings/learning" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen
        name="settings/cache"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="settings/theme"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="settings/about"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(stack)/manual-entry"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
