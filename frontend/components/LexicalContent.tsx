import React, { useEffect, useState } from "react"
import { Text, View, Linking, TouchableOpacity } from "react-native"
import { Image } from "expo-image"
import { VideoView, useVideoPlayer } from "expo-video"
import { useAudioPlayer } from "expo-audio"
import Slider from "@react-native-community/slider"
import { Ionicons } from "@expo/vector-icons"
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
  | { id: string; type: "quote"; elements: React.ReactNode[] }
  | { id: string; type: "list"; style: "bullet" | "number"; items: React.ReactNode[][] }
  | { id: string; type: "image"; url: string | null; caption?: string | null; aspectRatio?: number }
  | { id: string; type: "audio"; url: string | null; caption?: string | null }
  | { id: string; type: "video"; url: string | null; caption?: string | null }
  | { id: string; type: "relationship"; relationTo?: string; value?: any }

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
          case "quote":
            return (
              <View 
                key={block.id} 
                style={{ 
                  borderLeftWidth: 4, 
                  borderLeftColor: isDark ? "#475569" : "#cbd5e1",
                  paddingLeft: 16,
                  paddingVertical: 8,
                  backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    fontSize,
                    lineHeight,
                    color: mutedColor,
                    fontStyle: "italic",
                  }}
                >
                  {block.elements}
                </Text>
              </View>
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
            const effectiveImageUrl = cachedMedia[block.url] ?? block.url
            return (
              <View key={block.id} style={{ gap: 8 }}>
                <Image
                  source={{ uri: effectiveImageUrl }}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                  }}
                  contentFit="contain"
                  transition={200}
                />
                {block.caption ? (
                  <Text style={{ color: mutedColor, fontSize: fontSize - 2 }}>{block.caption}</Text>
                ) : null}
              </View>
            )
          case "audio":
            if (!block.url) return null
            const effectiveAudioUrl = cachedMedia[block.url] ?? block.url
            return (
              <AudioPlayer 
                key={block.id} 
                url={effectiveAudioUrl} 
                caption={block.caption}
                isDark={isDark}
                textColor={textColor}
                mutedColor={mutedColor}
                fontSize={fontSize}
              />
            )
          case "video":
            if (!block.url) return null
            const effectiveVideoUrl = cachedMedia[block.url] ?? block.url
            return (
              <VideoPlayer 
                key={block.id} 
                url={effectiveVideoUrl} 
                caption={block.caption}
                isDark={isDark}
                mutedColor={mutedColor}
                fontSize={fontSize}
              />
            )
          case "relationship":
            // Relationships are typically for internal linking or user mentions
            // For now, render a simple badge or skip
            return (
              <View 
                key={block.id} 
                style={{ 
                  paddingHorizontal: 12, 
                  paddingVertical: 6, 
                  backgroundColor: isDark ? "#1e293b" : "#e0e7ff",
                  borderRadius: 6,
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ color: isDark ? "#a5b4fc" : "#4338ca", fontSize: fontSize - 2 }}>
                  @{block.relationTo || "reference"}
                </Text>
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
        case "quote": {
          const elements = collectRichText(node, nodeKey)
          if (elements.length > 0) {
            blocks.push({ id: nodeKey, type: "quote", elements })
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
          const value = node.value ?? null
          const url = resolveMediaUrl(value)
          if (url) {
            // Determine media type from the value object
            const mimeType = value?.mimeType || value?.mime_type || ""
            let blockType: "image" | "audio" | "video" = "image"
            
            if (mimeType.startsWith("audio/")) {
              blockType = "audio"
            } else if (mimeType.startsWith("video/")) {
              blockType = "video"
            }
            
            blocks.push({
              id: nodeKey,
              type: blockType,
              url,
              caption: typeof node.caption === "string" ? node.caption : null,
            })
          }
          break
        }
        case "relationship": {
          blocks.push({
            id: nodeKey,
            type: "relationship",
            relationTo: node.relationTo,
            value: node.value,
          })
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

// Audio Player Component
type AudioPlayerProps = {
  url: string
  caption?: string | null
  isDark: boolean
  textColor: string
  mutedColor: string
  fontSize: number
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, caption, isDark, mutedColor, fontSize }) => {
  const player = useAudioPlayer(url)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        if (player && !isSeeking) {
          const newTime = player.currentTime || 0
          const newDuration = player.duration || 0
          setCurrentTime(newTime)
          if (newDuration > 0) {
            setDuration(newDuration)
          }
          setIsPlaying(player.playing)
        }
      } catch {
        // Player might be unmounted, ignore
      }
    }, 100)

    return () => clearInterval(interval)
  }, [player, isSeeking])

  const togglePlayPause = () => {
    try {
      if (!player) return
      
      if (isPlaying) {
        player.pause()
      } else {
        player.play()
      }
    } catch (error) {
      console.error("Error toggling playback:", error)
    }
  }

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSliderChange = (value: number) => {
    setCurrentTime(value)
  }

  const handleSlidingStart = () => {
    setIsSeeking(true)
  }

  const handleSlidingComplete = (value: number) => {
    try {
      if (player && duration > 0) {
        player.seekTo(value)
      }
    } catch (error) {
      console.error("Error seeking audio:", error)
    }
    setIsSeeking(false)
  }

  return (
    <View style={{ gap: 8 }}>
      <View 
        style={{ 
          backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity 
            onPress={togglePlayPause}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: isDark ? "#3b82f6" : "#2563eb",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons 
              name={isPlaying ? "pause" : "play"} 
              size={24} 
              color="white" 
              style={{ marginLeft: isPlaying ? 0 : 2 }}
            />
          </TouchableOpacity>
          
          <View style={{ flex: 1, gap: 4 }}>
            {/* Slider for draggable progress */}
            <Slider
              style={{ width: "100%", height: 40 }}
              minimumValue={0}
              maximumValue={duration || 1}
              value={currentTime}
              onValueChange={handleSliderChange}
              onSlidingStart={handleSlidingStart}
              onSlidingComplete={handleSlidingComplete}
              minimumTrackTintColor={isDark ? "#3b82f6" : "#2563eb"}
              maximumTrackTintColor={isDark ? "#334155" : "#e2e8f0"}
              thumbTintColor={isDark ? "#3b82f6" : "#2563eb"}
            />
            
            {/* Time display */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: -8 }}>
              <Text style={{ color: mutedColor, fontSize: fontSize - 4 }}>
                {formatTime(currentTime)}
              </Text>
              <Text style={{ color: mutedColor, fontSize: fontSize - 4 }}>
                {formatTime(duration)}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {caption ? (
        <Text style={{ color: mutedColor, fontSize: fontSize - 2 }}>{caption}</Text>
      ) : null}
    </View>
  )
}

// Video Player Component
type VideoPlayerProps = {
  url: string
  caption?: string | null
  isDark: boolean
  mutedColor: string
  fontSize: number
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, caption, isDark, mutedColor, fontSize }) => {
  const player = useVideoPlayer(url, (player) => {
    player.loop = false
  })

  return (
    <View style={{ gap: 8 }}>
      <View 
        style={{ 
          borderRadius: 12, 
          overflow: "hidden",
          backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
        }}
      >
        <VideoView
          player={player}
          style={{ width: "100%", aspectRatio: 16 / 9 }}
          allowsFullscreen
          allowsPictureInPicture
        />
      </View>
      {caption ? (
        <Text style={{ color: mutedColor, fontSize: fontSize - 2 }}>{caption}</Text>
      ) : null}
    </View>
  )
}
