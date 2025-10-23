import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  SafeAreaView,
  Share,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function WebPage() {
  const { url, title } = useLocalSearchParams() as { url?: string; title?: string };
  const router = useRouter();
  const [WebViewComponent, setWebViewComponent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const webviewRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      setLoading(false);
      return;
    }

    let mounted = true;
    import("react-native-webview")
      .then((mod) => {
        if (mounted) setWebViewComponent(() => mod.WebView ?? mod.default ?? mod);
      })
      .catch(() => {
        // ignore, will fallback to Linking
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const onReload = () => {
    if (webviewRef.current && typeof webviewRef.current.reload === "function") {
      webviewRef.current.reload();
    }
  };

  const onShare = async () => {
    try {
      if (url) await Share.share({ message: String(url), url: String(url), title: title ?? "Link" });
    } catch (e) {
      console.warn("Share failed", e);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={[styles.header, Platform.OS === "ios" ? styles.headerIos : null]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Text style={{ color: "#007aff" }}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            {title ?? "Web"}
          </Text>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={onReload} style={styles.headerActionButton}>
              <Text style={{ color: "#007aff" }}>Reload</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onShare} style={styles.headerActionButton}>
              <Text style={{ color: "#007aff" }}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1 }}>
        {WebViewComponent ? (
          <WebViewComponent ref={webviewRef} source={{ uri: String(url ?? "") }} style={{ flex: 1 }} startInLoadingState />
        ) : loading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" />
            <Text style={{ marginTop: 8 }}>Loading...</Text>
          </View>
        ) : (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 16 }}>
            <Text>Unable to show in-app.</Text>
            {url ? (
              <Text style={{ marginTop: 12, color: "#007aff" }} onPress={() => Linking.openURL(String(url))}>
                Open in browser
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    // leave background transparent where possible so system area can blend
    backgroundColor: "transparent",
  },
  headerIos: {
    // give a slight translucent effect on iOS so the status area feels blended
    backgroundColor: "rgba(255,255,255,0.6)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#eee",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  headerButton: {
    paddingRight: 12,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionButton: {
    marginLeft: 8,
  },
});
