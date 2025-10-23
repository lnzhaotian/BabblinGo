import React, { useEffect, useState } from "react";
import { View, Text, Button, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import axios from "axios";
import { config } from "../../lib/config";
import { useRouter } from "expo-router";

export default function Index() {
  const [data, setData] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    axios
      .get(`${config.apiUrl}/api`)
      .then((response) => {
        setData(response.data);
      })
      .catch((error) => {
        console.error("Error fetching data from API:", error);
      });
  }, []);

  const openWeb = (url: string, title = "Web") => {
    // navigate to web subpage with query params
    router.push({ pathname: "/web", params: { url, title } });
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>BabblinGo</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={{ marginBottom: 12 }}>
          <Button title="Open BabblinGuide" onPress={() => openWeb("https://babblinguide.cn/babblingo/index.html", "BabblinGuide")} />
        </View>
        <View style={{ marginBottom: 12 }}>
          <Button title="Open External Site (browser)" onPress={() => openWeb("https://babblinguide.cn", "External")} />
        </View>

        {data ? (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 16, fontWeight: "600" }}>API:</Text>
            <Text style={{ marginTop: 8 }}>{data}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
