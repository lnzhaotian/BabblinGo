import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Platform, Button, Linking } from "react-native";
import axios from "axios";
import { config } from "../lib/config";

const EXTERNAL_URL = "https://babblinguide.cn/babblingo/index.html";

export default function Index() {
  const [data, setData] = useState<string | null>(null);
  const [WebViewComponent, setWebViewComponent] = useState<any | null>(null);
  const [loadingWebview, setLoadingWebview] = useState(true);

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

  useEffect(() => {
    // Try dynamic import of react-native-webview for native platforms
    if (Platform.OS === "web") {
      setLoadingWebview(false);
      return;
    }

    let mounted = true;
    import("react-native-webview")
      .then((mod) => {
        if (mounted) setWebViewComponent(() => mod.WebView ?? mod.default ?? mod);
      })
      .catch((err) => {
        console.warn("react-native-webview not available, will fallback to Linking:", err);
      })
      .finally(() => {
        if (mounted) setLoadingWebview(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // If WebView loaded and available, render it
  if (WebViewComponent) {
    const WebView = WebViewComponent;
    return (
      <View style={{ flex: 1 }}>
        <WebView source={{ uri: EXTERNAL_URL }} style={{ flex: 1 }} startInLoadingState />
      </View>
    );
  }

  // If still attempting to load WebView, show a loader
  if (loadingWebview) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading...</Text>
      </View>
    );
  }

  // Fallback: show a basic view with a button to open in the system browser
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>Open BabblinGuide</Text>
      <Text style={{ color: "#666", marginBottom: 16 }}>{EXTERNAL_URL}</Text>
      <Button title="Open in browser" onPress={() => Linking.openURL(EXTERNAL_URL)} />
      {data ? (
        <Text style={{ marginTop: 20, color: "#333" }}>{data}</Text>
      ) : null}
    </View>
  );
}
