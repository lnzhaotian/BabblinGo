import React from "react"
import { Text, View, Linking } from "react-native"
import { Image } from "expo-image"
import type { LexicalRichText } from "@/lib/payload"
import { resolveMediaUrl } from "@/lib/payload"

type LexicalNode = {
  type?: string
  tag?: string
  text?: string
  format?: number
  listType?: string
  url?: string
  children?: LexicalNode[]
  [key: string]: any
}

type ContentBlock = 
  | { id: string; type: "heading"; level: number; elements: React.ReactNode[] }
  | { id: string; type: "paragraph"; elements: React.ReactNode[] }
  | { id: string; type: "list"; style: "bullet" | "number"; items: React.ReactNode[][] }
  | { id: string; type: "image"; url: string | null; caption?: string | null; aspectRatio?: number }

type LexicalContentProps = {
  content: LexicalRichText | null | undefined
  cachedMedia?: Record<string, string>
  colorScheme?: "light" | "dark"
  fontSize?: number
  lineHeight?: number
}

export const LexicalContent: React.FC<LexicalContentProps> = ({
  content,
  cachedMedia = {},
  colorScheme = "light",
  fontSize = 16,
  lineHeight = 24,
}) => {
  const blocks = parseLexicalContent(content)
  
  if (blocks.length === 0) {
    return null
  }

  const isDark = colorScheme === "dark"
  const textColor = isDark ? "#e2e8f0" : "#1f2937"
  const mutedColor = isDark ? "#cbd5f5" : "#4b5563"

  return (
    <View style={{ gap: 16 }}>
      {blocks.map((block) => {
        switch (block.type) {
          case "heading":
            return (
              <Text
                key={block.id}
                style={{
                  fontSize: block.level >= 3 ? fontSize + 4 : fontSize + 6,
                  fontWeight: "700",
                  color: textColor,
                  lineHeight: block.level >= 3 ? lineHeight + 4 : lineHeight + 6,
                }}
              >
                {block.elements}
              </Text>
            )
          case "paragraph":
            return (
              <Text
                key={block.id}
                style={{
                  fontSize,
                  lineHeight,
                  color: textColor,
                }}
              >
                {block.elements}
              </Text>
            )
          case "list":
            return (
              <View key={block.id} style={{ gap: 8 }}>
                {block.items.map((item, index) => (
                  <View key={`${block.id}-item-${index}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <Text style={{ color: mutedColor, fontSize }}>
                      {block.style === "number" ? `${index + 1}.` : "•"}
                    </Text>
                    <Text style={{ flex: 1, color: textColor, fontSize, lineHeight }}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            )
          case "image":
            if (!block.url) return null
            const effectiveUrl = cachedMedia[block.url] ?? block.url
            return (
              <View key={block.id} style={{ gap: 8 }}>
                <Image
                  source={{ uri: effectiveUrl }}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                    aspectRatio: block.aspectRatio ?? 16 / 9,
                  }}
                  contentFit="cover"
                />
                {block.caption ? (
                  <Text style={{ color: mutedColor, fontSize: fontSize - 2 }}>{block.caption}</Text>
                ) : null}
              </View>
            )
          default:
            return null
        }
      })}
    </View>
  )
}

const parseLexicalContent = (body: LexicalRichText | null | undefined): ContentBlock[] => {
  const rootChildren = body?.root?.children
  if (!Array.isArray(rootChildren)) {
    return []
  }

  const blocks: ContentBlock[] = []

  const walk = (nodes: LexicalNode[], keyPrefix: string) => {
    nodes.forEach((node, index) => {
      const nodeKey = `${keyPrefix}-${index}`
      switch (node?.type) {
        case "heading": {
          const elements = collectRichText(node, nodeKey)
          if (elements.length > 0) {
            const level = typeof node.tag === "string" && /^h[1-6]$/i.test(node.tag)
              ? Number(node.tag.slice(1)) || 2
              : 2
            blocks.push({ id: nodeKey, type: "heading", level, elements })
          }
          break
        }
        case "paragraph": {
          const elements = collectRichText(node, nodeKey)
          if (elements.length > 0) {
            blocks.push({ id: nodeKey, type: "paragraph", elements })
          }
          break
        }
        case "list": {
          const items: React.ReactNode[][] = []
          if (Array.isArray(node.children)) {
            node.children.forEach((child, childIdx) => {
              const itemElements = collectRichText(child, `${nodeKey}-item-${childIdx}`)
              if (itemElements.length > 0) {
                items.push(itemElements)
              }
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
          const url = resolveMediaUrl(node.value ?? null)
          if (url) {
            blocks.push({
              id: nodeKey,
              type: "image",
              url,
              caption: typeof node.caption === "string" ? node.caption : null,
            })
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

// Collect rich text with formatting (bold, italic, links, linebreaks)
const collectRichText = (node: LexicalNode | undefined, keyPrefix: string): React.ReactNode[] => {
  if (!node) {
    return []
  }

  const elements: React.ReactNode[] = []
  let textBuffer = ""
  let formatBuffer = 0

  const flushBuffer = (key: string) => {
    if (textBuffer) {
      const isBold = (formatBuffer & 1) !== 0
      const isItalic = (formatBuffer & 2) !== 0
      
      elements.push(
        <Text
          key={key}
          style={{
            fontWeight: isBold ? "700" : "400",
            fontStyle: isItalic ? "italic" : "normal",
          }}
        >
          {textBuffer}
        </Text>
      )
      textBuffer = ""
      formatBuffer = 0
    }
  }

  const walkInline = (n: LexicalNode, prefix: string) => {
    if (!n) return

    if (n.type === "text" && typeof n.text === "string") {
      // Check if format changed
      const currentFormat = n.format ?? 0
      if (currentFormat !== formatBuffer) {
        flushBuffer(`${prefix}-flush`)
      }
      textBuffer += n.text
      formatBuffer = currentFormat
      return
    }

    if (n.type === "linebreak") {
      flushBuffer(`${prefix}-before-br`)
      elements.push(<Text key={`${prefix}-br`}>{"\n"}</Text>)
      return
    }

    if (n.type === "link") {
      flushBuffer(`${prefix}-before-link`)
      const linkText = collectPlainText(n)
      const linkUrl = n.url || "#"
      elements.push(
        <Text
          key={`${prefix}-link`}
          style={{ color: "#2563eb", textDecorationLine: "underline" }}
          onPress={() => {
            if (linkUrl && linkUrl !== "#") {
              Linking.openURL(linkUrl).catch((err) => console.error("Failed to open link:", err))
            }
          }}
        >
          {linkText}
        </Text>
      )
      return
    }

    // Recurse into children
    if (Array.isArray(n.children)) {
      n.children.forEach((child, idx) => {
        walkInline(child, `${prefix}-${idx}`)
      })
    }
  }

  if (Array.isArray(node.children)) {
    node.children.forEach((child, idx) => {
      walkInline(child, `${keyPrefix}-c${idx}`)
    })
  }

  flushBuffer(`${keyPrefix}-final`)
  
  return elements
}

// Simple plain text extraction for links
const collectPlainText = (node: LexicalNode | undefined): string => {
  if (!node) return ""
  if (typeof node.text === "string") return node.text
  if (!Array.isArray(node.children)) return ""
  return node.children.map(collectPlainText).join("")
}
