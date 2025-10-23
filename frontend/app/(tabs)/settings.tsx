import React from "react";
import { View, Text } from "react-native";

export default function Settings() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Settings</Text>
      <Text style={{ marginTop: 8, color: "#666" }}>App settings go here</Text>
    </View>
  );
}
