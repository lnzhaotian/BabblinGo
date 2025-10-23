import React from "react";
import { View, Text } from "react-native";

export default function Tests() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Tests</Text>
      <Text style={{ marginTop: 8, color: "#666" }}>Placeholder for tests</Text>
    </View>
  );
}
