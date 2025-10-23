import React from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

type LessonItem = {
  id: number;
  title: string;
  subtitle: string;
  url: string;
};

export default function Index() {
  const router = useRouter();

  const lessons: LessonItem[] = Array.from({ length: 14 }, (_, i) => {
    const idx = i + 1;
    const padded = String(idx).padStart(2, "0");
    const code = `l0s1l${padded}`;
    const url = `https://babblinguide.cn/babblingo/${code}/tutorial.html`;
    return {
      id: idx,
      title: `Lesson ${padded}`,
      subtitle: `第${idx}课`,
      url,
    };
  });

  const openLesson = (item: LessonItem) => {
    router.push({ pathname: "/(stack)/web", params: { url: item.url, title: item.title } });
  };

  const renderItem = ({ item }: { item: LessonItem }) => (
    <TouchableOpacity
      onPress={() => openLesson(item)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
      }}
    >
      <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center", marginRight: 12 }}>
        <MaterialIcons name="menu-book" size={24} color="#333" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
        <Text style={{ marginTop: 4, color: "#666" }}>{item.subtitle}</Text>
      </View>

      <MaterialIcons name="chevron-right" size={28} color="#999" />
    </TouchableOpacity>
  );

  const insets = useSafeAreaInsets();

  return (
    // only apply safe-area padding at top here; we'll handle bottom padding on the list
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View style={{ padding: 16, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>BabblinGo</Text>
      </View>

      <FlatList
        data={lessons}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
        style={{ flex: 1 }}
      />

    </SafeAreaView>
  );
}
