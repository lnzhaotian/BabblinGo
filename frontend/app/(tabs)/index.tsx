import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { extractModules, fetchLessonsByLevelSlug, LessonDoc } from "@/lib/payload";
import type { ModuleDoc } from "@/lib/payload";

const NOVICE_LEVEL_SLUG = "novice";

export default function Index() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [lessons, setLessons] = useState<LessonDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        console.error("Failed to load lessons", err);
        setError(t("home.loadError"));
      } finally {
        if (!skipLoading) {
          setLoading(false);
        }
      }
    },
    [t, i18n]
  );

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

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
          borderBottomColor: "#eee",
          opacity: hasModules ? 1 : 0.6,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            backgroundColor: "#f0f0f0",
            justifyContent: "center",
            alignItems: "center",
            marginRight: 12,
          }}
        >
          <MaterialIcons name="menu-book" size={24} color="#333" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "600" }}>{t("home.lesson", { number: padded })}</Text>
          {summary ? <Text style={{ marginTop: 4, color: "#666" }}>{summary}</Text> : null}
        </View>

        {hasModules ? (
          <MaterialIcons name="chevron-right" size={28} color="#999" />
        ) : null}
      </Pressable>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={{ padding: 8, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>{t("home.title")}</Text>
      </View>

      {error ? (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ color: "#b71c1c", textAlign: "center" }}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={lessons}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={{
          backgroundColor: "#fff",
          flexGrow: lessons.length === 0 ? 1 : undefined,
        }}
        style={{ flex: 1, backgroundColor: "transparent", paddingVertical: 8 }}
        ListEmptyComponent={
          !error ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: "#666" }}>{t("home.noDisplay")}</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
