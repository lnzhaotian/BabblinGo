import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function Tests() {
  const router = useRouter();

  const open = (url: string, title: string) => {
    router.push({ pathname: "/(stack)/web", params: { url, title } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f6f7fb" }} edges={["top"]}>
      {/* Title/header area */}
      <View style={{ padding: 8, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>测试</Text>
      </View>

      {/* Content area */}
      <View style={{ flex: 1, padding: 16 }}>
        <TouchableOpacity
          onPress={() => open("https://babblinguide.cn/placement/", "Placement Test")}
          style={{ padding: 16, borderRadius: 8, backgroundColor: "#fff", marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700" }}>ACTFL语言能力自测题</Text>
          <Text style={{ marginTop: 6, color: "#666" }}>判断您当前的语言能力水平</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => open("https://babblinguide.cn/achievement/l0s1/test.html", "Achievement Test")}
          style={{ padding: 16, borderRadius: 8, backgroundColor: "#fff", marginBottom: 12, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6 }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700" }}>零基础教练课测试</Text>
          <Text style={{ marginTop: 6, color: "#666" }}>判断您是否已掌握我们的零基础教练课中的内部</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
