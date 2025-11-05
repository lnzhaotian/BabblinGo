import React, { useMemo, useState } from "react"
import { ScrollView, Text, View } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useTranslation } from "react-i18next"
import { Image } from "expo-image"

import { LessonDoc, ModuleDoc, MediaDoc, extractModuleSlides, resolveMediaUrl } from "@/lib/payload"
import { useThemeMode } from "@/app/theme-context"
import type { LexicalRichText } from "@/lib/payload"
import { useLearningSession } from "@/hooks/useLearningSession"
import { useLessonCache } from "@/hooks/useLessonCache"
import { ThemedHeader } from "@/components/ThemedHeader"
import { LessonHeaderControls } from "@/components/LessonHeaderControls"
import { CacheMenuModal } from "@/components/CacheMenuModal"

export type RichPostModuleViewProps = {
  lesson: LessonDoc
  module: ModuleDoc
}

export const RichPostModuleView: React.FC<RichPostModuleViewProps> = ({
  lesson,
  module,
}) => {
  const { t } = useTranslation()
  const { colorScheme } = useThemeMode()

  useLearningSession(lesson.id, lesson.title, { enabled: false })

  const slide = useMemo(() => {
    const slides = extractModuleSlides(module)
    return slides[0] ?? null
  }, [module])

  const {
    cachedMedia,
    cachingInProgress,
    lessonCacheStatus,
    cacheMenuVisible,
    setCacheMenuVisible,
    handleClearCache,
    handleRedownload,
  } = useLessonCache(lesson)

  const contentBlocks = useMemo(
    () => parseLexicalBody(slide?.body ?? module.richPost?.body ?? null),
    [slide?.body, module.richPost?.body]
  )

  const resolvedContentBlocks = useMemo(() =>
    contentBlocks.map((block) => {
      if (block.type !== "image" || !block.url) {
        return block
      }
      const effectiveUrl = cachedMedia[block.url] ?? block.url
      if (effectiveUrl === block.url) {
        return block
      }
      return {
        ...block,
        url: effectiveUrl,
      }
    }),
  [contentBlocks, cachedMedia])

  const resolvedGallery = useMemo(() => {
    const galleryEntries = module.richPost?.mediaGallery ?? slide?.richPost?.mediaGallery ?? []

    return galleryEntries.map((entry) => {
      const originalUrl = resolveMediaUrl(entry.media)
      const cachedUrl = originalUrl ? cachedMedia[originalUrl] ?? originalUrl : null
      return {
        id: entry.id ?? originalUrl ?? "gallery-entry",
        url: cachedUrl,
        caption: entry.caption ?? null,
      }
    })
  }, [module.richPost?.mediaGallery, slide?.richPost?.mediaGallery, cachedMedia])
  const [ratio, setRatio] = useState(1.5)

  const headerTitle = module.title || lesson.title

  return (
    <>
      <ThemedHeader
        overrideTitle={headerTitle}
        headerRight={() => (
          <LessonHeaderControls
            loopEnabled={false}
            cachingInProgress={cachingInProgress}
            cacheStatus={lessonCacheStatus}
            onToggleLoop={() => {}}
            onOpenCacheMenu={() => setCacheMenuVisible(true)}
            showLoopToggle={false}
          />
        )}
      />
      <SafeAreaView
      style={{ flex: 1, backgroundColor: colorScheme === "dark" ? "#0f172a" : "#fff" }}
      edges={["bottom"]}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 20 }}>
        <View style={{ gap: 12 }}>
          {module.summary ? (
            <Text style={{ fontSize: 16, color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>
              {module.summary}
            </Text>
          ) : null}
        </View>

        {resolvedContentBlocks.length > 0 ? (
          <View style={{ gap: 18 }}>
            {resolvedContentBlocks.map((block) => {
              switch (block.type) {
                case "heading":
                  return (
                    <Text
                      key={block.id}
                      style={{
                        fontSize: block.level >= 3 ? 20 : 22,
                        fontWeight: "700",
                        color: colorScheme === "dark" ? "#e2e8f0" : "#1f2937",
                      }}
                    >
                      {block.text}
                    </Text>
                  )
                case "paragraph":
                  return (
                    <Text
                      key={block.id}
                      style={{ fontSize: 17, lineHeight: 26, color: colorScheme === "dark" ? "#e2e8f0" : "#1f2937" }}
                    >
                      {block.text}
                    </Text>
                  )
                case "list":
                  return (
                    <View key={block.id} style={{ gap: 8 }}>
                      {block.items.map((item, index) => (
                        <View key={`${block.id}-item-${index}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                          <Text style={{ color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>
                            {block.style === "number" ? `${index + 1}.` : "•"}
                          </Text>
                          <Text style={{ flex: 1, color: colorScheme === "dark" ? "#e2e8f0" : "#1f2937", lineHeight: 24 }}>
                            {item}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )
                case "image":
                  if (!block.url) {
                    return null
                  }
                  return (
                    <View key={block.id} style={{ gap: 8 }}>
                      <Image
                        source={{ uri: block.url }}
                        onLoad={({ source }) => setRatio(source.width / source.height)}
                        style={{
                          width: "100%",
                          borderRadius: 18,
                          backgroundColor: "#0f172a",
                          aspectRatio: block.aspectRatio && block.aspectRatio > 0 ? block.aspectRatio : ratio,
                        }}
                        contentFit="cover"
                      />
                      {block.caption ? (
                        <Text style={{ color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>{block.caption}</Text>
                      ) : null}
                    </View>
                  )
                default:
                  return null
              }
            })}
          </View>
        ) : (
          <View style={{ padding: 16, borderRadius: 12, backgroundColor: colorScheme === "dark" ? "#1e293b" : "#f1f5f9" }}>
            <Text style={{ color: colorScheme === "dark" ? "#94a3b8" : "#64748b" }}>
              {t("lesson.richPost.empty", { defaultValue: "No content has been added yet." })}
            </Text>
          </View>
        )}

        {resolvedGallery.length > 0 ? (
          <View style={{ gap: 16 }}>
            {resolvedGallery.map((entry) => {
              if (!entry.url) {
                return null
              }
              return (
                <View key={entry.id} style={{ gap: 8 }}>
                  <Image
                    source={{ uri: entry.url }}
                    style={{ width: "100%", aspectRatio: 3 / 2, borderRadius: 18, backgroundColor: "#0f172a" }}
                    contentFit="cover"
                  />
                  {entry.caption ? (
                    <Text style={{ color: colorScheme === "dark" ? "#cbd5f5" : "#4b5563" }}>{entry.caption}</Text>
                  ) : null}
                </View>
              )
            })}
          </View>
        ) : null}
      </ScrollView>

      <CacheMenuModal
        visible={cacheMenuVisible}
        onClose={() => setCacheMenuVisible(false)}
        cacheStatus={lessonCacheStatus}
        onRedownload={handleRedownload}
        onClear={handleClearCache}
      />
    </SafeAreaView>
  </>
)
}

type LexicalNode = {
  type?: string
  tag?: string
  children?: LexicalNode[]
  listType?: "bullet" | "number" | "check"
  value?: unknown
  fields?: any
  src?: string
  altText?: string | null
  caption?: string | null
  width?: number | null
  height?: number | null
  [key: string]: unknown
}

type RichPostBlock =
  | { id: string; type: "heading"; level: number; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "list"; style: "bullet" | "number"; items: string[] }
  | { id: string; type: "image"; url: string | null; caption?: string | null; aspectRatio?: number | null }

const parseLexicalBody = (body: LexicalRichText | null | undefined): RichPostBlock[] => {
  const rootChildren = body?.root?.children
  if (!Array.isArray(rootChildren)) {
    return []
  }

  const blocks: RichPostBlock[] = []

  const walk = (nodes: LexicalNode[], keyPrefix: string) => {
    nodes.forEach((node, index) => {
      const nodeKey = `${keyPrefix}-${index}`
      switch (node?.type) {
        case "heading": {
          const text = collectText(node)
          if (text) {
            const level = typeof node.tag === "string" && /^h[1-6]$/i.test(node.tag)
              ? Number(node.tag.slice(1)) || 2
              : 2
            blocks.push({ id: nodeKey, type: "heading", level, text })
          }
          addInlineUploads(node, nodeKey, blocks)
          break
        }
        case "paragraph": {
          const text = collectText(node)
          if (text) {
            blocks.push({ id: nodeKey, type: "paragraph", text })
          }
          addInlineUploads(node, nodeKey, blocks)
          break
        }
        case "list": {
          const items: string[] = []
          if (Array.isArray(node.children)) {
            node.children.forEach((child, childIndex) => {
              const itemText = collectText(child)
              if (itemText) {
                items.push(itemText)
              }
              addInlineUploads(child, `${nodeKey}-item-${childIndex}`, blocks)
            })
          }
          if (items.length > 0) {
            const style: "bullet" | "number" = node.listType === "number" ? "number" : "bullet"
            blocks.push({ id: nodeKey, type: "list", style, items })
          }
          break
        }
        case "upload":
        case "image": {
          const imageBlock = resolveImageBlock(node, nodeKey)
          if (imageBlock) {
            blocks.push(imageBlock)
          }
          break
        }
        default: {
          if (Array.isArray(node?.children)) {
            walk(node.children, nodeKey)
          }
        }
      }
    })
  }

  walk(rootChildren as LexicalNode[], "node")

  return blocks
}

const collectText = (node: LexicalNode | undefined): string => {
  if (!node) {
    return ""
  }

  if (typeof (node as any)?.text === "string") {
    return (node as any).text
  }

  if (!Array.isArray(node.children)) {
    return ""
  }

  return node.children.map((child) => collectText(child)).join(" ").replace(/\s+/g, " ").trim()
}

const addInlineUploads = (node: LexicalNode, key: string, blocks: RichPostBlock[]) => {
  if (!Array.isArray(node.children)) {
    return
  }

  node.children.forEach((child, idx) => {
    if (child?.type === "upload" || child?.type === "image") {
      const resolved = resolveImageBlock(child, `${key}-inline-${idx}`)
      if (resolved) {
        blocks.push(resolved)
      }
    }
  })
}

const resolveImageBlock = (node: LexicalNode, id: string): RichPostBlock | null => {
  const url = resolveUnknownMediaToUrl(node)
  if (!url) {
    return null
  }

  const caption = resolveCaption(node)
  const aspectRatio = resolveAspectRatio(node)

  return {
    id,
    type: "image",
    url,
    caption,
    aspectRatio,
  }
}

const resolveCaption = (node: LexicalNode): string | null => {
  const fields = (node.fields ?? node.value ?? {}) as Record<string, unknown>
  const captionCandidates = [node.caption, fields.caption, fields.altText, fields.alt]
  const caption = captionCandidates.find((value) => typeof value === "string" && value.trim().length > 0)
  return caption ? (caption as string) : null
}

const resolveAspectRatio = (node: LexicalNode): number | null => {
  const width = typeof node.width === "number" ? node.width : typeof (node.fields?.width) === "number" ? (node.fields as any).width : null
  const height = typeof node.height === "number" ? node.height : typeof (node.fields?.height) === "number" ? (node.fields as any).height : null
  if (width && height && width > 0 && height > 0) {
    return width / height
  }
  return null
}

const resolveUnknownMediaToUrl = (node: LexicalNode): string | null => {
  const candidates = [node, node.fields, node.value]
  for (const candidate of candidates) {
    const url = coerceMediaUrl(candidate)
    if (url) {
      return url
    }
  }

  if (typeof node.src === "string" && node.src.trim().length > 0) {
    return resolveMediaUrl(node.src)
  }

  return null
}

const coerceMediaUrl = (value: unknown): string | null => {
  if (!value) {
    return null
  }

  if (typeof value === "string") {
    return resolveMediaUrl(value)
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>

    if (typeof objectValue.url === "string" || typeof objectValue.filename === "string") {
      const mediaDoc: MediaDoc = {
        id: typeof objectValue.id === "string" ? objectValue.id : "inline-media",
        url: typeof objectValue.url === "string" ? objectValue.url : undefined,
        filename: typeof objectValue.filename === "string" ? objectValue.filename : undefined,
        mimeType: typeof objectValue.mimeType === "string" ? objectValue.mimeType : undefined,
      }
      return resolveMediaUrl(mediaDoc)
    }

    if (objectValue.media) {
      const nested = coerceMediaUrl(objectValue.media)
      if (nested) {
        return nested
      }
    }

    if (objectValue.image) {
      const nested = coerceMediaUrl(objectValue.image)
      if (nested) {
        return nested
      }
    }

    if (objectValue.asset) {
      const nested = coerceMediaUrl(objectValue.asset)
      if (nested) {
        return nested
      }
    }

    if (objectValue.fields) {
      const nested = coerceMediaUrl(objectValue.fields)
      if (nested) {
        return nested
      }
    }
  }

  return null
}
