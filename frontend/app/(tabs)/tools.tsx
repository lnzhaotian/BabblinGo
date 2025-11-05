import React, { useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useRouter } from "expo-router"
import { useTranslation } from "react-i18next"
import { MaterialIcons } from "@expo/vector-icons"

import { fetchTools, resolveLocalizedField, ToolDoc } from "@/lib/payload"
import { useThemeMode } from "../theme-context"

const FALLBACK_ICON: keyof typeof MaterialIcons.glyphMap = "handyman"

const getIconName = (rawIcon?: string | null): keyof typeof MaterialIcons.glyphMap => {
  if (!rawIcon) {
    return FALLBACK_ICON
  }

  if (Object.prototype.hasOwnProperty.call(MaterialIcons.glyphMap, rawIcon)) {
    return rawIcon as keyof typeof MaterialIcons.glyphMap
  }

  return FALLBACK_ICON
}

const openTool = (
  router: ReturnType<typeof useRouter>,
  url: string,
  title: string
) => {
  router.push({ pathname: "/(stack)/web", params: { url, title } })
}

export default function Tools() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { colorScheme } = useThemeMode()

  const [tools, setTools] = useState<ToolDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const locale = i18n.language

  const loadTools = useCallback(
    async (skipLoading = false) => {
      if (!skipLoading) {
        setLoading(true)
      }

      try {
        const data = await fetchTools(locale)
        setTools(data)
        setError(null)
      } catch (err) {
        console.error("Failed to load tools", err)
        setError(t("tools.loadError"))
      } finally {
        if (!skipLoading) {
          setLoading(false)
        }
      }
    },
    [locale, t]
  )

  useEffect(() => {
    loadTools()
  }, [loadTools])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadTools(true)
    setRefreshing(false)
  }, [loadTools])

  const contentBackground = colorScheme === "dark" ? "#18181b" : "#f6f7fb"
  const cardBackground = colorScheme === "dark" ? "#23232a" : "#fff"
  const shadowColor = colorScheme === "dark" ? "#000" : "#000"

  const localizedTools = useMemo(() => {
    return tools.map((tool) => {
      const title =
        resolveLocalizedField(tool.title, locale) ?? tool.url.replace(/^https?:\/\//, "")
      const description = resolveLocalizedField(tool.description, locale) ?? undefined
      const iconName = getIconName(tool.icon)
      const category = tool.category ?? undefined

      return {
        ...tool,
        title,
        description,
        iconName,
        category,
      }
    })
  }, [tools, locale])

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: contentBackground }}
        edges={[]}
      >
        <ActivityIndicator size="large" />
      </SafeAreaView>
    )
  }

  return (
    <>
  {/* Header handled by Tabs layout; avoid per-screen header overrides */}
      <SafeAreaView style={{ flex: 1, backgroundColor: contentBackground }} edges={["top", "left", "right"]}>
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 24,
            flexGrow: localizedTools.length === 0 ? 1 : undefined,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {error ? (
            <View style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: colorScheme === "dark" ? "#3f1d1d" : "#fee2e2",
              borderWidth: 1,
              borderColor: colorScheme === "dark" ? "#7f1d1d" : "#fecaca",
              marginBottom: 16,
            }}>
              <Text style={{ color: colorScheme === "dark" ? "#fca5a5" : "#c53030", textAlign: "center" }}>{error}</Text>
            </View>
          ) : null}

          {localizedTools.length === 0 && !error ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: colorScheme === "dark" ? "#d1d5db" : "#4b5563", textAlign: "center", paddingHorizontal: 24 }}>
                {t("tools.empty")}
              </Text>
            </View>
          ) : null}

          {localizedTools.map((tool) => (
            <Pressable
              key={tool.id}
              onPress={() => openTool(router, tool.url, tool.title)}
              android_ripple={{ color: "#e5e7eb" }}
              style={{
                marginBottom: 16,
                borderRadius: 16,
                backgroundColor: cardBackground,
                padding: 18,
                shadowColor,
                shadowOpacity: colorScheme === "dark" ? 0.35 : 0.07,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
                borderWidth: colorScheme === "dark" ? 1 : 0,
                borderColor: colorScheme === "dark" ? "#2f2f36" : "transparent",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    backgroundColor: colorScheme === "dark" ? "#1e1e26" : "#eef2ff",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: 16,
                  }}
                >
                  <MaterialIcons name={tool.iconName} size={28} color={colorScheme === "dark" ? "#a5b4fc" : "#4f46e5"} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 18,
                      fontWeight: "700",
                      color: colorScheme === "dark" ? "#fff" : "#111827",
                    }}
                  >
                    {tool.title}
                  </Text>
                  {tool.description ? (
                    <Text
                      style={{
                        marginTop: 6,
                        color: colorScheme === "dark" ? "#d1d5db" : "#4b5563",
                        lineHeight: 20,
                      }}
                      numberOfLines={3}
                    >
                      {tool.description}
                    </Text>
                  ) : null}

                  {tool.category ? (
                    <View style={{
                      marginTop: 12,
                      alignSelf: "flex-start",
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      backgroundColor: colorScheme === "dark" ? "#312e81" : "#e0e7ff",
                    }}>
                      <Text style={{ color: colorScheme === "dark" ? "#c7d2fe" : "#4338ca", fontSize: 12, fontWeight: "600" }}>
                        {tool.category}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <MaterialIcons name="chevron-right" size={24} color={colorScheme === "dark" ? "#a1a1aa" : "#9ca3af"} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </>
  )
}
