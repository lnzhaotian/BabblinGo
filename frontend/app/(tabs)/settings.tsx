import React from "react";
import { View, Text, Pressable } from "react-native";
import { Link } from "expo-router";

export default function Settings() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Settings</Text>
      <Text style={{ marginTop: 8, color: "#666", textAlign: "center" }}>App settings go here</Text>
      <Link href="/(tabs)/progress" asChild>
        <Pressable style={{ marginTop: 16, backgroundColor: "#6366f1", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>View Learning Records</Text>
        </Pressable>
      </Link>
    </View>
  );
}
