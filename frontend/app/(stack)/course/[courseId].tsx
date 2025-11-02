import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import {
  CourseDoc,
  CourseLevel,
  LessonDoc,
  extractModules,
  fetchCourseById,
  fetchLessonsByCourse,
  resolveLocalizedField,
  resolveMediaUrl,
} from "@/lib/payload";
import { getLessonCacheStatus, LessonCacheStatus } from "@/lib/cache-manager";
import { ThemedHeader } from "@/components/ThemedHeader";
import { useThemeMode } from "../../theme-context";

const sortByOrder = <T extends { order?: number | null }>(items: T[] = []): T[] =>
  [...items].sort((a, b) => {
    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });

const CourseDetail = () => {
  const { courseId, title: routeTitle } = useLocalSearchParams<{ courseId?: string; title?: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colorScheme } = useThemeMode();

  const [course, setCourse] = useState<CourseDoc | null>(null);
  const [lessons, setLessons] = useState<LessonDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheStatuses, setCacheStatuses] = useState<Record<string, LessonCacheStatus>>({});
  const [selectedLevelKey, setSelectedLevelKey] = useState<string | null>(null);

  const locale = i18n.language;
  const resolvedCourseId = courseId ? String(courseId) : undefined;

  const loadCacheStatuses = useCallback(async (list: LessonDoc[]) => {
    if (!list.length) {
      setCacheStatuses({});
      return;
    }

    const result: Record<string, LessonCacheStatus> = {};

    await Promise.all(
      list.map(async (lesson) => {
        if (!lesson.updatedAt) {
          result[lesson.id] = "none";
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
          result[lesson.id] = "none";
          return;
        }

        try {
          const info = await getLessonCacheStatus(mediaUrls, lesson.updatedAt);
          result[lesson.id] = info.status;
        } catch (statusError) {
          console.error(`Failed to compute cache status for lesson ${lesson.id}`, statusError);
          result[lesson.id] = "none";
        }
      }),
    );

    setCacheStatuses(result);
  }, []);

  const loadData = useCallback(
    async (skipLoading = false) => {
      if (!resolvedCourseId) {
        setError(t("course.error"));
        setLoading(false);
        return;
      }

      if (!skipLoading) {
        setLoading(true);
      }

      try {
        const [courseResponse, lessonsResponse] = await Promise.all([
          fetchCourseById(resolvedCourseId, locale),
          fetchLessonsByCourse(resolvedCourseId, { locale }),
        ]);

        setCourse(courseResponse);
        setLessons(lessonsResponse);
        setError(null);
    await loadCacheStatuses(lessonsResponse);
      } catch (err) {
        console.error("Failed to load course detail", err);
        setError(t("course.error"));
      } finally {
        if (!skipLoading) {
          setLoading(false);
        }
      }
    },
    [resolvedCourseId, locale, t, loadCacheStatuses],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!course) {
      setSelectedLevelKey(null);
      return;
    }

    const sorted = sortByOrder<CourseLevel>(course.levels ?? []);
    if (sorted.length === 0) {
      setSelectedLevelKey(null);
      return;
    }

    setSelectedLevelKey((prev) => (prev && sorted.some((level) => level.key === prev) ? prev : sorted[0].key));
  }, [course]);

  useFocusEffect(
    useCallback(() => {
      if (lessons.length > 0) {
        loadCacheStatuses(lessons).catch((err) => {
          console.error("Failed to refresh cache status on focus", err);
        });
      }
    }, [lessons, loadCacheStatuses]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  }, [loadData]);

  const headerTitle = useMemo(() => {
    const courseTitle = course ? resolveLocalizedField(course.title, locale) : null;
    if (courseTitle) {
      return courseTitle;
    }
    if (typeof routeTitle === "string" && routeTitle.trim().length > 0) {
      return routeTitle;
    }
    return t("course.defaultTitle");
  }, [course, routeTitle, locale, t]);

  const hasLevels = Boolean(course?.levels && course.levels.length > 0);

  const sortedLevels = useMemo(() => (hasLevels ? sortByOrder<CourseLevel>(course!.levels!) : []), [course, hasLevels]);

  const sortedLessons = useMemo(() => sortByOrder(lessons), [lessons]);

  const filteredLessons = useMemo(() => {
    if (!hasLevels || !selectedLevelKey) {
      return sortedLessons;
    }
    return sortedLessons.filter((lesson) => lesson.level === selectedLevelKey);
  }, [hasLevels, selectedLevelKey, sortedLessons]);

  useEffect(() => {
    if (!hasLevels || sortedLevels.length === 0) {
      return;
    }

    const hasSelectedLessons = sortedLessons.some((lesson) => lesson.level === selectedLevelKey);
    if (hasSelectedLessons) {
      return;
    }

    const fallback = sortedLevels.find((level) => sortedLessons.some((lesson) => lesson.level === level.key));
    if (fallback) {
      setSelectedLevelKey(fallback.key);
    }
  }, [hasLevels, sortedLevels, sortedLessons, selectedLevelKey]);

  const handleLessonPress = useCallback(
    (lesson: LessonDoc) => {
      const modules = extractModules(lesson);
      if (modules.length === 0) {
        return;
      }

      router.push({
        pathname: "/lesson/[lessonId]",
        params: { lessonId: lesson.id, title: lesson.title },
      } as never);
    },
    [router],
  );

  const renderLesson = useCallback(
    ({ item, index }: { item: LessonDoc; index: number }) => {
      const displayOrder = typeof item.order === "number" ? item.order : index + 1;
      const padded = String(displayOrder).padStart(2, "0");
      const summary = item.summary?.trim();
      const modules = extractModules(item);
      const hasModules = modules.length > 0;
      const cacheStatus = cacheStatuses[item.id] ?? "none";

      const cacheIcon = (() => {
        switch (cacheStatus) {
          case "full":
            return { name: "cloud-done" as const, color: "#10b981" };
          case "partial":
            return { name: "cloud-download" as const, color: "#f59e0b" };
          case "downloading":
            return { name: "cloud-download" as const, color: "#3b82f6" };
          default:
            return { name: "cloud-queue" as const, color: "#9ca3af" };
        }
      })();

      return (
        <Pressable
          onPress={() => handleLessonPress(item)}
          disabled={!hasModules}
          android_ripple={{ color: "#e5e7eb" }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: colorScheme === "dark" ? "#23232a" : "#e5e7eb",
            backgroundColor: colorScheme === "dark" ? "#18181b" : "#fff",
            opacity: hasModules ? 1 : 0.6,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: colorScheme === "dark" ? "#23232a" : "#eef2ff",
              justifyContent: "center",
              alignItems: "center",
              marginRight: 12,
            }}
          >
            <MaterialIcons name="menu-book" size={24} color={colorScheme === "dark" ? "#c7d2fe" : "#4338ca"} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colorScheme === "dark" ? "#fff" : "#111827" }}>
              {t("home.lesson", { number: padded })}
            </Text>
            {summary ? (
              <Text style={{ marginTop: 4, color: colorScheme === "dark" ? "#d1d5db" : "#4b5563" }} numberOfLines={2}>
                {summary}
              </Text>
            ) : null}
          </View>

          <View style={{ marginHorizontal: 8 }}>
            <MaterialIcons name={cacheIcon.name} size={20} color={cacheIcon.color} />
          </View>

          {hasModules ? (
            <MaterialIcons name="chevron-right" size={28} color={colorScheme === "dark" ? "#a1a1aa" : "#9ca3af"} />
          ) : null}
        </Pressable>
      );
    },
    [cacheStatuses, colorScheme, handleLessonPress, t],
  );

  const listHeader = useMemo(() => {
    if (!course) {
      return null;
    }

    const description = resolveLocalizedField(course.description, locale);
    const coverImageUrl = resolveMediaUrl(course.coverImage);
    const levels = sortedLevels.map((level) => ({
      key: level.key,
      label: resolveLocalizedField(level.label ?? level.key, locale) ?? level.key,
    }));

    if (!coverImageUrl && !description && levels.length === 0) {
      return null;
    }

    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: colorScheme === "dark" ? "#18181b" : "#fff" }}>
        {coverImageUrl ? (
          <View
            style={{
              borderRadius: 16,
              overflow: "hidden",
              marginBottom: 16,
              borderWidth: colorScheme === "dark" ? 1 : 0,
              borderColor: colorScheme === "dark" ? "#2f2f36" : "transparent",
            }}
          >
            <Image
              source={{ uri: coverImageUrl }}
              style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: colorScheme === "dark" ? "#111827" : "#eef2ff" }}
              resizeMode="cover"
            />
          </View>
        ) : null}

        {description ? (
          <Text style={{ color: colorScheme === "dark" ? "#e5e7eb" : "#4b5563", lineHeight: 20 }}>
            {description}
          </Text>
        ) : null}

        {levels.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 16 }}>
            {levels.map((level) => {
              const isSelected = level.key === selectedLevelKey;
              return (
                <Pressable
                  key={`${course.id}-chip-${level.key}`}
                  onPress={() => setSelectedLevelKey(level.key)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    marginRight: 8,
                    marginBottom: 8,
                    backgroundColor: isSelected
                      ? colorScheme === "dark" ? "#4338ca" : "#4f46e5"
                      : colorScheme === "dark" ? "#312e81" : "#e0e7ff",
                  }}
                >
                  <Text
                    style={{
                      color: isSelected
                        ? "#fff"
                        : colorScheme === "dark" ? "#c7d2fe" : "#4338ca",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {level.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }, [course, colorScheme, locale, selectedLevelKey, sortedLevels]);

  return (
    <>
      <ThemedHeader overrideTitle={headerTitle} />
      {loading ? (
        <SafeAreaView
          style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colorScheme === "dark" ? "#18181b" : "#fff" }}
          edges={["left", "right", "bottom"]}
        >
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12, color: colorScheme === "dark" ? "#d1d5db" : "#4b5563" }}>{t("course.loading")}</Text>
        </SafeAreaView>
      ) : error ? (
        <SafeAreaView
          style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colorScheme === "dark" ? "#18181b" : "#fff", paddingHorizontal: 24 }}
          edges={["left", "right", "bottom"]}
        >
          <Text style={{ textAlign: "center", color: colorScheme === "dark" ? "#ef4444" : "#b71c1c" }}>{error}</Text>
        </SafeAreaView>
      ) : (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#18181b" : "#f9fafb" }}
          edges={["left", "right", "bottom"]}
        >
          <FlatList
            data={filteredLessons}
            keyExtractor={(item) => item.id}
            renderItem={renderLesson}
            ListHeaderComponent={listHeader}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            contentContainerStyle={{
              paddingTop: 16,
              paddingBottom: 32,
              backgroundColor: colorScheme === "dark" ? "#18181b" : "#f9fafb",
              flexGrow: filteredLessons.length === 0 ? 1 : undefined,
            }}
            ListEmptyComponent={
              filteredLessons.length === 0 ? (
                <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24 }}>
                  <Text style={{ color: colorScheme === "dark" ? "#d1d5db" : "#4b5563", textAlign: "center" }}>
                    {t("course.empty")}
                  </Text>
                </View>
              ) : null
            }
          />
        </SafeAreaView>
      )}
    </>
  );
};

export default CourseDetail;
