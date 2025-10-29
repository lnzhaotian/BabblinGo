import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

export default function Tests() {
  const router = useRouter();
  const { t } = useTranslation();

  const open = (url: string, title: string) => {
    router.push({ pathname: "/(stack)/web", params: { url, title } });
  };

  return (
    <>
      <Stack.Screen options={{ title: t("tests.title") }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f6f7fb" }} edges={["bottom"]}>

      {/* Content area */}
      <View style={{ flex: 1, padding: 16 }}>
        <TouchableOpacity
          onPress={() => open("https://babblinguide.cn/placement/", "Placement Test")}
          style={{ padding: 16, borderRadius: 8, backgroundColor: "#fff", marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700" }}>{t("tests.placementTitle")}</Text>
          <Text style={{ marginTop: 6, color: "#666" }}>{t("tests.placementDescription")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => open("https://babblinguide.cn/achievement/l0s1/test.html", "Achievement Test")}
          style={{ padding: 16, borderRadius: 8, backgroundColor: "#fff", marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700" }}>{t("tests.achievementTitle")}</Text>
          <Text style={{ marginTop: 6, color: "#666" }}>{t("tests.achievementDescription")}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </>
  );
}
