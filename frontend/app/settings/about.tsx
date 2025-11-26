import React from "react";
import { View, Text, Pressable, ScrollView, Linking, Image } from "react-native";
// import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useThemeMode } from "../theme-context";
import { ThemedHeader } from "@/components/ThemedHeader";

// Replaced by ThemedHeader

export default function AboutSettings() {
  const { t } = useTranslation();
  const { colorScheme } = useThemeMode();

  const openWebsite = () => {
    Linking.openURL("https://babblinguide.cn");
  };

  const openICP = () => {
    Linking.openURL("https://beian.miit.gov.cn/");
  };

  const openPoliceRecord = () => {
    Linking.openURL("https://beian.mps.gov.cn/#/query/webSearch?code=11010502055961");
  };

  return (
    <>
      <ThemedHeader titleKey="settings.about" />
      <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#18181b' : "#f9fafb" }} edges={["bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* App Info */}
        <View
          style={{
            backgroundColor: colorScheme === 'dark' ? '#23232a' : "#fff",
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <View
            style={{
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Image
              source={require("@/assets/images/icon.png")}
              style={{
                width: 80,
                height: 80,
                borderRadius: 15,
              }}
              resizeMode="contain"
            />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "700", color: colorScheme === 'dark' ? '#fff' : "#1f2937", marginBottom: 4 }}>
            {t("settings.about.appName")}
          </Text>
          <Text style={{ fontSize: 16, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", textAlign: "center" }}>
            {t("settings.about.tagline")}
          </Text>
        </View>

        {/* App Description */}
        <View style={{ backgroundColor: colorScheme === 'dark' ? '#23232a' : "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", lineHeight: 22, marginBottom: 16 }}>
            {t("settings.about.appDescription")}
          </Text>

          <Text style={{ fontSize: 18, fontWeight: "700", color: colorScheme === 'dark' ? '#fff' : "#1f2937", marginBottom: 12 }}>
            {t("settings.about.whatWeDo")}
          </Text>
          <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", lineHeight: 22, marginBottom: 16 }}>
            {t("settings.about.whatWeDoDesc")}
          </Text>

          <Text style={{ fontSize: 18, fontWeight: "700", color: colorScheme === 'dark' ? '#fff' : "#1f2937", marginBottom: 12 }}>
            {t("settings.about.features")}
          </Text>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", lineHeight: 20 }}>
              • {t("settings.about.feature1")}
            </Text>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", lineHeight: 20 }}>
              • {t("settings.about.feature2")}
            </Text>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", lineHeight: 20 }}>
              • {t("settings.about.feature3")}
            </Text>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", lineHeight: 20 }}>
              • {t("settings.about.feature4")}
            </Text>
          </View>
        </View>

        {/* Our Philosophy */}
        <View style={{ backgroundColor: colorScheme === 'dark' ? '#23232a' : "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colorScheme === 'dark' ? '#fff' : "#1f2937", marginBottom: 12 }}>
            {t("settings.about.philosophy")}
          </Text>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colorScheme === 'dark' ? '#fff' : "#374151", marginBottom: 4 }}>
              {t("settings.about.philosophyNature")}
            </Text>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", lineHeight: 20 }}>
              {t("settings.about.philosophyNatureDesc")}
            </Text>
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colorScheme === 'dark' ? '#fff' : "#374151", marginBottom: 4 }}>
              {t("settings.about.philosophyLearning")}
            </Text>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", lineHeight: 20 }}>
              {t("settings.about.philosophyLearningDesc")}
            </Text>
          </View>

          <View>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colorScheme === 'dark' ? '#fff' : "#374151", marginBottom: 4 }}>
              {t("settings.about.philosophyActivation")}
            </Text>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", lineHeight: 20 }}>
              {t("settings.about.philosophyActivationDesc")}
            </Text>
          </View>
        </View>

        {/* About Us */}
        <View style={{ backgroundColor: colorScheme === 'dark' ? '#23232a' : "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colorScheme === 'dark' ? '#fff' : "#1f2937", marginBottom: 12 }}>
            {t("settings.about.aboutUs")}
          </Text>
          <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", lineHeight: 20, marginBottom: 12 }}>
            {t("settings.about.aboutUsDesc")}
          </Text>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#374151", lineHeight: 20 }}>
              <Text style={{ fontWeight: "600" }}>{t("settings.about.founder1")}</Text>
              {t("settings.about.founder1Desc")}
            </Text>
          </View>

          <View>
            <Text style={{ fontSize: 14, color: colorScheme === 'dark' ? '#d1d5db' : "#374151", lineHeight: 20 }}>
              <Text style={{ fontWeight: "600" }}>{t("settings.about.founder2")}</Text>
              {t("settings.about.founder2Desc")}
            </Text>
          </View>
        </View>

        {/* Website Link */}
        <Pressable
          onPress={openWebsite}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colorScheme === 'dark' ? '#23232a' : "#fff",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            ...(pressed ? { opacity: 0.7 } : {}),
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <MaterialIcons name="language" size={24} color="#6366f1" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: colorScheme === 'dark' ? '#fff' : "#1f2937" }}>
              {t("settings.about.website")}
            </Text>
          </View>
          <MaterialIcons name="open-in-new" size={20} color={colorScheme === 'dark' ? '#d1d5db' : "#9ca3af"} />
        </Pressable>

        {/* Company Info */}
        <View style={{ backgroundColor: colorScheme === 'dark' ? '#23232a' : "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: colorScheme === 'dark' ? '#d1d5db' : "#6b7280", textAlign: "center", marginBottom: 8 }}>
            ©2024 {t("settings.about.company")}
          </Text>

          <Pressable onPress={openICP} style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 13, color: "#6366f1", textAlign: "center" }}>京ICP2024079024号</Text>
          </Pressable>

          <Pressable onPress={openPoliceRecord}>
            <Text style={{ fontSize: 13, color: "#6366f1", textAlign: "center" }}>
              京公网安备11010502055961
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
    </>
  );
}
