import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";

export default function WebPage() {
  const { url, title } = useLocalSearchParams() as { url?: string; title?: string };
  const [WebViewComponent, setWebViewComponent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  const webviewRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

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

  // share removed per request

  return (
    <>
      <Stack.Screen
        options={{
          title: title ?? "Web",
          headerBackButtonDisplayMode: "minimal",
          headerRight: () => (
            <TouchableOpacity onPress={onReload} style={styles.iconButton} accessibilityLabel="Reload">
              <MaterialIcons name="refresh" size={22} color="#007aff" />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={{ flex: 1 }}>
        {WebViewComponent ? (
          (() => {
            const injected = `
              (function() {
                try {
                  // ensure viewport fits safe area on iOS
                  var meta = document.querySelector('meta[name=viewport]');
                  if (!meta) {
                    meta = document.createElement('meta');
                    meta.name = 'viewport';
                    meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover';
                    document.head.appendChild(meta);
                  } else if (meta.content.indexOf('viewport-fit') === -1) {
                    meta.content = meta.content + ', viewport-fit=cover';
                  }

                  // add safe-area padding and prevent _blank from opening external bars
                  var style = document.createElement('style');
                  style.innerHTML = 'html,body{height:100%;margin:0;padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box;}-webkit-touch-callout:none;';
                  document.head.appendChild(style);

                  // override window.open to avoid opening new browser UI
                  window.open = function(url) { window.location.href = url; };
                } catch (e) {}
              })(); true;
            `;

            return (
              <WebViewComponent
                ref={webviewRef}
                source={{ uri: String(url ?? "") }}
                style={{ flex: 1, marginBottom: insets.bottom }}
                startInLoadingState
                injectedJavaScriptBeforeContentLoaded={injected}
                
              />
            );
          })()
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
    </>
  );
}

const styles = StyleSheet.create({
  // Removed custom header styles as native header is used
  iconButton: {
    paddingHorizontal: 8,
    paddingVertical: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  
});
