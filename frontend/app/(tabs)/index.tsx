import React, { useCallback, useEffect, useState, useMemo } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { CourseDoc, CourseLevel, fetchCourses, fetchTools, resolveLocalizedField, resolveMediaUrl, ToolDoc } from "@/lib/payload";
import { useThemeMode } from "../theme-context";
import { useCourseUpdates } from "@/hooks/useCourseUpdates";

const sortByOrder = <T extends { order?: number | null }>(items: T[] = []): T[] =>
  [...items].sort((a, b) => {
    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });

const FALLBACK_ICON: keyof typeof MaterialIcons.glyphMap = "handyman"

const getIconName = (rawIcon?: string | null): keyof typeof MaterialIcons.glyphMap => {
  if (!rawIcon) {
    return FALLBACK_ICON
  }

  if (Object.prototype.hasOwnProperty.call(MaterialIcons.glyphMap, rawIcon)) {
    return rawIcon as keyof typeof MaterialIcons.glyphMap
  }

  return FALLBACK_ICON
}

type CombinedItem = 
  | { type: 'course'; data: CourseDoc }
  | { type: 'tool'; data: ToolDoc }
  | { type: 'feature'; data: { id: string; title: string; icon: string; route: string; description: string } }

export default function Index() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [courses, setCourses] = useState<CourseDoc[]>([]);
  const [tools, setTools] = useState<ToolDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colorScheme } = useThemeMode();
  const { hasUpdates, markCourseAsSeen } = useCourseUpdates();

  const loadCourses = useCallback(
    async (skipLoading = false) => {
      if (!skipLoading) {
        setLoading(true);
      }

      try {
        const locale = i18n.language;
        const [coursesData, toolsData] = await Promise.all([
          fetchCourses(locale),
          fetchTools(locale)
        ]);
        setCourses(coursesData);
        setTools(toolsData);
        setError(null);
      } catch (err) {
        console.error("Failed to load data", err);
        setError(t("home.loadCoursesError"));
      } finally {
        if (!skipLoading) {
          setLoading(false);
        }
      }
    },
    [t, i18n]
  );

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCourses(true);
    setRefreshing(false);
  }, [loadCourses]);

  const handlePressCourse = (course: CourseDoc, title: string) => {
    markCourseAsSeen(course.id, course.updatedAt);
    const target = {
      pathname: "/course/[courseId]",
      params: { courseId: course.id, title },
    } as const;

    router.push(target as never);
  };

  const handlePressTool = (tool: ToolDoc, title: string) => {
    router.push({ pathname: "/(stack)/web", params: { url: tool.url, title } });
  };

  const combinedData = useMemo((): CombinedItem[] => {
    const items: CombinedItem[] = [];
    
    courses.forEach(course => items.push({ type: 'course', data: course }));
    tools.forEach(tool => items.push({ type: 'tool', data: tool }));
    
    items.push({ 
      type: 'feature', 
      data: { 
        id: 'babblingears', 
        title: t('agents.title'), 
        icon: 'psychology', 
        route: '/(stack)/agents',
        description: t('agents.description')
      } 
    });

    return items;
  }, [courses, tools, t, i18n.language]);

  const renderCourse = ({ item }: { item: CourseDoc }) => {
    const locale = i18n.language;
    const courseTitle = resolveLocalizedField(item.title, locale) ?? t("home.untitledCourse");
    const description = resolveLocalizedField(item.description, locale);
    const coverImageUrl = resolveMediaUrl(item.coverImage);
    const sortedLevels = sortByOrder<CourseLevel>(item.levels ?? []);
    const levelLabels = sortedLevels
      .map((level) => resolveLocalizedField(level.label ?? level.key, locale) ?? level.key)
      .filter((label) => label.trim().length > 0);
    
    const showUpdateDot = hasUpdates(item);

    return (
      <Pressable
        onPress={() => handlePressCourse(item, courseTitle)}
        android_ripple={{ color: "#e5e7eb" }}
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          borderRadius: 16,
          backgroundColor: colorScheme === 'dark' ? '#23232a' : '#fff',
          borderWidth: colorScheme === 'dark' ? 1 : 0,
          borderColor: colorScheme === 'dark' ? '#2f2f36' : 'transparent',
          shadowColor: colorScheme === 'dark' ? '#000' : '#000',
          shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: "row", padding: 16 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              backgroundColor: colorScheme === 'dark' ? '#18181b' : '#eef2ff',
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
              marginRight: 16,
            }}
          >
            {coverImageUrl ? (
              <Image
                source={{ uri: coverImageUrl }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <MaterialIcons name="menu-book" size={32} color={colorScheme === 'dark' ? '#6366f1' : '#4f46e5'} />
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colorScheme === 'dark' ? '#fff' : '#111827',
              }}
            >
              {courseTitle}
            </Text>
            {description ? (
              <Text
                style={{
                  marginTop: 6,
                  color: colorScheme === 'dark' ? '#d1d5db' : '#4b5563',
                  lineHeight: 20,
                }}
                numberOfLines={3}
              >
                {description}
              </Text>
            ) : null}

            {levelLabels.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
                {levelLabels.map((label, idx) => (
                  <View
                    key={`${item.id}-level-${idx}`}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: colorScheme === 'dark' ? '#312e81' : '#e0e7ff',
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: colorScheme === 'dark' ? '#c7d2fe' : '#4338ca', fontSize: 12, fontWeight: "600" }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={{ justifyContent: "center", marginLeft: 8 }}>
            <MaterialIcons name="chevron-right" size={28} color={colorScheme === 'dark' ? '#a1a1aa' : '#9ca3af'} />
          </View>
        </View>
        {showUpdateDot && (
          <View
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              backgroundColor: '#ef4444',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colorScheme === 'dark' ? '#23232a' : '#fff',
              shadowColor: "#ef4444",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
              NEW
            </Text>
          </View>
        )}
      </Pressable>
    );
  };

  const renderTool = ({ item }: { item: ToolDoc }) => {
    const locale = i18n.language;
    const title = resolveLocalizedField(item.title, locale) ?? item.url.replace(/^https?:\/\//, "");
    const description = resolveLocalizedField(item.description, locale) ?? undefined;
    const iconName = getIconName(item.icon);
    const category = item.category ?? undefined;

    return (
      <Pressable
        onPress={() => handlePressTool(item, title)}
        android_ripple={{ color: "#e5e7eb" }}
        style={{
          marginHorizontal: 16,
          marginBottom: 16,
          borderRadius: 16,
          backgroundColor: colorScheme === 'dark' ? '#23232a' : '#fff',
          // padding: 18,
          shadowColor: colorScheme === 'dark' ? '#000' : '#000',
          shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
          borderWidth: colorScheme === 'dark' ? 1 : 0,
          borderColor: colorScheme === 'dark' ? '#2f2f36' : 'transparent',
        }}
      >
        <View style={{ flexDirection: "row", padding: 16 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 12,
              backgroundColor: colorScheme === 'dark' ? '#18181b' : '#eef2ff',
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
              marginRight: 16,
            }}
          >
            <MaterialIcons name={iconName} size={32} color={colorScheme === 'dark' ? '#a5b4fc' : '#4f46e5'} />
          </View>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: colorScheme === 'dark' ? '#fff' : '#111827',
              }}
            >
              {title}
            </Text>
            {description ? (
              <Text
                style={{
                  marginTop: 6,
                  color: colorScheme === 'dark' ? '#d1d5db' : '#4b5563',
                  lineHeight: 20,
                }}
                numberOfLines={3}
              >
                {description}
              </Text>
            ) : null}

            {category ? (
              <View style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: colorScheme === 'dark' ? '#312e81' : '#e0e7ff',
                marginRight: 8,
                marginBottom: 8,
              }}>
                <Text style={{ color: colorScheme === 'dark' ? '#c7d2fe' : '#4338ca', fontSize: 12, fontWeight: "600" }}>
                  {category}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ justifyContent: "center", marginLeft: 8 }}>
            <MaterialIcons name="chevron-right" size={28} color={colorScheme === 'dark' ? '#a1a1aa' : '#9ca3af'} />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderItem = ({ item }: { item: CombinedItem }) => {
    if (item.type === 'course') {
      return renderCourse({ item: item.data });
    } else if (item.type === 'tool') {
      return renderTool({ item: item.data });
    } else if (item.type === 'feature') {
      const { title, description, icon, route } = item.data;
      return (
        <Pressable
          onPress={() => router.push(route as any)}
          android_ripple={{ color: "#e5e7eb" }}
          style={{
            marginHorizontal: 16,
            marginBottom: 16,
            borderRadius: 16,
            backgroundColor: colorScheme === 'dark' ? '#23232a' : '#fff',
            shadowColor: colorScheme === 'dark' ? '#000' : '#000',
            shadowOpacity: colorScheme === 'dark' ? 0.4 : 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 2,
            borderWidth: colorScheme === 'dark' ? 1 : 0,
            borderColor: colorScheme === 'dark' ? '#2f2f36' : 'transparent',
          }}
        >
          <View style={{ flexDirection: "row", padding: 16 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                backgroundColor: colorScheme === 'dark' ? '#18181b' : '#eef2ff',
                justifyContent: "center",
                alignItems: "center",
                overflow: "hidden",
                marginRight: 16,
              }}
            >
              <MaterialIcons name={icon as any} size={32} color={colorScheme === 'dark' ? '#a5b4fc' : '#4f46e5'} />
            </View>
            <View style={{ flex: 1}}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colorScheme === 'dark' ? '#fff' : '#111827' }}>
                {title}
              </Text>
              <Text style={{ marginTop: 4, color: colorScheme === 'dark' ? '#d1d5db' : '#4b5563' }}>
                {description}
              </Text>
            </View>
            <View style={{ justifyContent: "center", marginLeft: 8 }}>
              <MaterialIcons name="chevron-right" size={28} color={colorScheme === 'dark' ? '#a1a1aa' : '#9ca3af'} />
            </View>
          </View>
        </Pressable>
      );
    }
    return null;
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
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : '#f9fafb' }} edges={['top', 'left', 'right']}>
        {error ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ color: colorScheme === 'dark' ? '#ef4444' : "#b71c1c", textAlign: "center" }}>{error}</Text>
          </View>
        ) : null}
        <FlatList
          data={combinedData}
          keyExtractor={(item) => {
            if (item.type === 'course') {
              return `course-${item.data.id}`;
            } else if (item.type === 'tool') {
              return `tool-${item.data.id}`;
            } else {
              return `feature-${item.data.id}`;
            }
          }}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={{
            paddingVertical: 16,
            backgroundColor: colorScheme === 'dark' ? '#18181b' : '#f9fafb',
            flexGrow: combinedData.length === 0 ? 1 : undefined,
          }}
          style={{ flex: 1, backgroundColor: "transparent", paddingVertical: 8 }}
          ListEmptyComponent={
            !error ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ color: colorScheme === 'dark' ? '#d1d5db' : "#4b5563", textAlign: "center", paddingHorizontal: 32 }}>
                  {t("home.noCourses")}
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </>
  );
}
