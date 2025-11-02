import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";

import { extractModules, fetchLessonsByLevelSlug, LessonDoc, resolveMediaUrl } from "@/lib/payload";
import type { ModuleDoc } from "@/lib/payload";
import { getLessonCacheStatus, LessonCacheStatus } from "@/lib/cache-manager";
import { useThemeMode } from "../theme-context";

const NOVICE_LEVEL_SLUG = "novice";

export default function Index() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [lessons, setLessons] = useState<LessonDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStatuses, setCacheStatuses] = useState<Record<string, LessonCacheStatus>>({});
  const { colorScheme } = useThemeMode();

  // Load cache status for all lessons
  const loadCacheStatuses = useCallback(async (lessonsList: LessonDoc[]) => {
    const statuses: Record<string, LessonCacheStatus> = {};

    await Promise.all(
      lessonsList.map(async (lesson) => {
        if (!lesson.updatedAt) {
          statuses[lesson.id] = 'none';
          return;
        }

        const modules = extractModules(lesson);
        const mediaUrls: string[] = [];

        for (const module of modules) {
          const imageUrl = resolveMediaUrl(module.image);
          const audioUrl = resolveMediaUrl(module.audio);
          if (imageUrl) mediaUrls.push(imageUrl);
          if (audioUrl) mediaUrls.push(audioUrl);
        }

        if (mediaUrls.length === 0) {
          statuses[lesson.id] = 'none';
          return;
        }

        try {
          const info = await getLessonCacheStatus(mediaUrls, lesson.updatedAt);
          statuses[lesson.id] = info.status;
        } catch (error) {
          console.error(`Failed to get cache status for lesson ${lesson.id}:`, error);
          statuses[lesson.id] = 'none';
        }
      })
    );

    setCacheStatuses(statuses);
  }, []);

  const loadLessons = useCallback(
    async (skipLoading = false) => {
      if (!skipLoading) {
        setLoading(true);
      }

      try {
        const locale = i18n.language;
        const data = await fetchLessonsByLevelSlug(NOVICE_LEVEL_SLUG, locale);
        setLessons(data);
        setError(data.length === 0 ? t("home.noLessons") : null);

        // Load cache statuses for all lessons
        loadCacheStatuses(data);
      } catch (err) {
        console.error("Failed to load lessons", err);
        setError(t("home.loadError"));
      } finally {
        if (!skipLoading) {
          setLoading(false);
        }
      }
    },
    [t, i18n, loadCacheStatuses]
  );

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  // Reload cache statuses when screen comes into focus (e.g., after returning from lesson page)
  useFocusEffect(
    useCallback(() => {
      if (lessons.length > 0) {
        loadCacheStatuses(lessons);
      }
    }, [lessons, loadCacheStatuses])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLessons(true);
    setRefreshing(false);
  }, [loadLessons]);

  const handlePress = (lesson: LessonDoc, modules: ModuleDoc[]) => {
    if (modules.length === 0) {
      return;
    }

    const target = {
      pathname: "/lesson/[lessonId]",
      params: { lessonId: lesson.id, title: lesson.title },
    } as const;

    router.push(target as never);
  };

  const renderItem = ({ item, index }: { item: LessonDoc; index: number }) => {
    const position = typeof item.order === "number" ? item.order : index + 1;
    const padded = String(position).padStart(2, "0");
    const summary = item.summary?.trim();
    const modules = extractModules(item);
    const hasModules = modules.length > 0;
    const cacheStatus = cacheStatuses[item.id] || 'none';

    // Cache status icon and color
    const getCacheIcon = () => {
      switch (cacheStatus) {
        case 'full':
          return { name: 'cloud-done' as const, color: '#10b981' }; // Green cloud with check
        case 'partial':
          return { name: 'cloud-download' as const, color: '#f59e0b' }; // Amber
        case 'downloading':
          return { name: 'cloud-download' as const, color: '#3b82f6' }; // Blue
        case 'none':
        default:
          return { name: 'cloud-queue' as const, color: '#9ca3af' }; // Gray
      }
    };

    const cacheIcon = getCacheIcon();

    return (
      <Pressable
        onPress={() => handlePress(item, modules)}
        android_ripple={{ color: "#f0f0f0" }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 12,
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: colorScheme === 'dark' ? '#23232a' : '#eee',
          opacity: hasModules ? 1 : 0.6,
          backgroundColor: colorScheme === 'dark' ? '#18181b' : undefined,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            backgroundColor: colorScheme === 'dark' ? '#23232a' : '#f0f0f0',
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}
        >
          <MaterialIcons name="menu-book" size={24} color={colorScheme === 'dark' ? '#fff' : '#333'} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colorScheme === 'dark' ? '#fff' : undefined }}>{t("home.lesson", { number: padded })}</Text>
          {summary ? <Text style={{ marginTop: 4, color: colorScheme === 'dark' ? '#d1d5db' : "#666" }}>{summary}</Text> : null}
        </View>

        {/* Cache status indicator */}
        <View style={{ marginRight: 8 }}>
          <MaterialIcons name={cacheIcon.name} size={20} color={cacheIcon.color} />
        </View>

        {hasModules ? (
          <MaterialIcons name="chevron-right" size={28} color={colorScheme === 'dark' ? '#a1a1aa' : '#999'} />
        ) : null}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colorScheme === 'dark' ? '#18181b' : undefined }} edges={[]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <>
  {/* Header handled by Tabs layout; avoid per-screen header overrides */}
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : undefined }} edges={['top', 'left', 'right']}>
        {error ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ color: colorScheme === 'dark' ? '#ef4444' : "#b71c1c", textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}
        <FlatList
          data={lessons}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{
            backgroundColor: colorScheme === 'dark' ? '#18181b' : "#fff",
            flexGrow: lessons.length === 0 ? 1 : undefined,
          }}
          style={{ flex: 1, backgroundColor: "transparent", paddingVertical: 8 }}
          ListEmptyComponent={
            !error ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ color: colorScheme === 'dark' ? '#d1d5db' : "#666" }}>{t("home.noDisplay")}</Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </>
  );
}
