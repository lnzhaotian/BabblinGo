import React from "react";
import { View, Text, Pressable, ScrollView, Linking, Image } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

export default function AboutSettings() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const isZh = i18n.language.startsWith("zh");

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
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f9fafb" }} edges={["top"]}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 8 }}>
          <MaterialIcons name="arrow-back" size={24} color="#1f2937" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937", marginLeft: 8 }}>
          {isZh ? "关于我们" : "About"}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* App Info */}
        <View
          style={{
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 20,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              backgroundColor: "#6366f1",
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Image
              source={require("@/assets/images/logo.png")}
              style={{
                width: 60,
                height: 60,
              }}
              resizeMode="contain"
            />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "700", color: "#1f2937", marginBottom: 4 }}>
            {isZh ? "语言漫游指南" : "BabblinGuide"}
          </Text>
          <Text style={{ fontSize: 16, color: "#6b7280", textAlign: "center" }}>
            {isZh ? "用自然的方式学语言" : "Learning languages the natural way"}
          </Text>
        </View>

        {/* Our Philosophy */}
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937", marginBottom: 12 }}>
            {isZh ? "我们的理念" : "Our Philosophy"}
          </Text>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 4 }}>
              {isZh ? "语言的本质" : "The Nature of Language"}
            </Text>
            <Text style={{ fontSize: 14, color: "#6b7280", lineHeight: 20 }}>
              {isZh ? "用声音来表达意象" : "Expressing mental representations through sound"}
            </Text>
          </View>

          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 4 }}>
              {isZh ? "语言学习的本质" : "The Nature of Language Learning"}
            </Text>
            <Text style={{ fontSize: 14, color: "#6b7280", lineHeight: 20 }}>
              {isZh ? "建立声音与意象的连接" : "Building connections between sound and mental representations"}
            </Text>
          </View>

          <View>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#374151", marginBottom: 4 }}>
              {isZh ? "习得激活期" : "Acquisition Activation Phase"}
            </Text>
            <Text style={{ fontSize: 14, color: "#6b7280", lineHeight: 20 }}>
              {isZh ? "搞定习得激活期，不怕走弯路" : "Activate your LAD properly, learn without detours"}
            </Text>
          </View>
        </View>

        {/* About Us */}
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#1f2937", marginBottom: 12 }}>
            {isZh ? "关于我们" : "About Us"}
          </Text>
          <Text style={{ fontSize: 14, color: "#6b7280", lineHeight: 20, marginBottom: 12 }}>
            {isZh ? "破除迷思，解构语言学习" : "Breaking myths, deconstructing language learning"}
          </Text>

          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: "#374151", lineHeight: 20 }}>
              <Text style={{ fontWeight: "600" }}>{isZh ? "创始人 - 赵金海：" : "Founder - Zhao Jinhai: "}</Text>
              {isZh
                ? "北京奥运会志愿者外语培训教学总监、教材主编"
                : "Teaching Director & Chief Editor, Beijing Olympics Volunteer Language Training"}
            </Text>
          </View>

          <View>
            <Text style={{ fontSize: 14, color: "#374151", lineHeight: 20 }}>
              <Text style={{ fontWeight: "600" }}>{isZh ? "创始人 - 曾易：" : "Founder - Zeng Yi: "}</Text>
              {isZh
                ? "北京海淀10年资深少儿英语教师"
                : "10-Year Senior Children's English Teacher, Beijing Haidian"}
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
            backgroundColor: "#fff",
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <MaterialIcons name="language" size={24} color="#6366f1" />
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#1f2937" }}>
              {isZh ? "官方网站" : "Official Website"}
            </Text>
          </View>
          <MaterialIcons name="open-in-new" size={20} color="#9ca3af" />
        </Pressable>

        {/* Company Info */}
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 8 }}>
            ©2024 {isZh ? "北京巴布林文化传播有限公司" : "Beijing BabblinGuide Culture Communications Co., Ltd."}
          </Text>

          <Pressable onPress={openICP} style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 13, color: "#6366f1", textAlign: "center" }}>京ICP备2024079024号</Text>
          </Pressable>

          <Pressable onPress={openPoliceRecord}>
            <Text style={{ fontSize: 13, color: "#6366f1", textAlign: "center" }}>
              京公网安备11010502055961
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
