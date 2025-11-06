import React from 'react';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useThemeMode } from '../app/theme-context';

/**
 * ThemedHeader
 * Renders a Stack.Screen with localized title and theme-aware colors.
 * Avoids flicker by hiding the header until theme and i18n are hydrated.
 */
export function ThemedHeader({ titleKey, overrideTitle, headerRight, hideTitle }: { titleKey?: string; overrideTitle?: string; headerRight?: () => React.ReactNode; hideTitle?: boolean }) {
  const { i18n, t } = useTranslation();
  const { colorScheme, hydrated } = useThemeMode();

  const ready = hydrated && i18n.isInitialized;
  const computedTitle = hideTitle ? '' : (overrideTitle ?? (titleKey ? t(titleKey) : ''));

  // Always show header to reserve space; when not ready, make it transparent and hide back/title to avoid flicker.
  return (
    <Stack.Screen
      options={
        ready
          ? {
              headerShown: true,
              headerTransparent: false,
              headerTitle: computedTitle,
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#18181b',
              headerBackButtonDisplayMode: 'minimal',
              headerBackVisible: true,
              // Always set headerRight; when not provided, clear any previous actions
              headerRight: headerRight ?? (() => null),
            }
          : {
              headerShown: true,
              headerTransparent: false,
              headerTitle: '',
              headerStyle: { backgroundColor: colorScheme === 'dark' ? '#18181b' : '#fff' },
              headerTintColor: colorScheme === 'dark' ? '#fff' : '#18181b',
              headerBackVisible: false,
              headerRight: () => null,
            }
      }
    />
  );
}

export default ThemedHeader;
