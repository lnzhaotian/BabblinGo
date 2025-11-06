import type { AudioContent, LexicalRichText, LessonDoc, MediaDoc, ModuleDoc } from "@/lib/payload"
import { getLessonModules, resolveMediaUrl } from "@/lib/payload"
import { config } from "@/lib/config"

/**
 * Check if a URL is a cacheable media file from our own storage
 * (not external streaming services like YouTube, Vimeo, etc.)
 */
const isCacheableUrl = (url: string): boolean => {
  if (!url) return false
  
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    
    // Allow our API domain
    const apiUrlObj = new URL(config.apiUrl)
    if (hostname === apiUrlObj.hostname.toLowerCase()) {
      return true
    }
    
    // Allow OSS/S3 storage domains for our media
    if (hostname.includes('aliyuncs.com') || // Alibaba Cloud OSS
        hostname.includes('amazonaws.com') || // AWS S3
        hostname.includes('cloudflare') || // Cloudflare R2/CDN
        hostname.includes('babblingo') ||  // Any babblingo subdomain
        hostname.includes('babblinguide')) { // Any babblinguide subdomain
      return true
    }
    
    // Block known external streaming services
    const blockedDomains = ['youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'twitch.tv']
    if (blockedDomains.some(domain => hostname.includes(domain))) {
      return false
    }
    
    // For other domains, check if it looks like a media file by extension
    const path = urlObj.pathname.toLowerCase()
    const mediaExtensions = ['.mp3', '.mp4', '.wav', '.m4a', '.aac', '.ogg', 
                            '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
                            '.pdf', '.vtt', '.srt']
    return mediaExtensions.some(ext => path.endsWith(ext))
  } catch {
    // If URL parsing fails, don't cache it
    return false
  }
}

/**
 * Collect all media URLs referenced by a lesson's modules. The returned URLs are
 * normalized via `resolveMediaUrl` so they can be used for caching lookups.
 * Only includes URLs from our own server (uploaded media), not external services.
 */
export const collectLessonMediaUrls = (lesson: LessonDoc): string[] => {
  const modules = getLessonModules(lesson)
  const urls = new Set<string>()

  modules.forEach((module) => {
    collectModuleMediaUrls(module, urls)
  })

  return Array.from(urls)
}

const collectModuleMediaUrls = (module: ModuleDoc, urls: Set<string>) => {
  const moduleType = module.type ?? "audioSlideshow"

  switch (moduleType) {
    case "audioSlideshow":
      collectAudioSlideshowUrls(module, urls)
      break
    case "audio":
      collectAudioPlaylistUrls(module, urls)
      break
    case "video":
      collectVideoModuleUrls(module, urls)
      break
    case "richPost":
      collectRichPostUrls(module, urls)
      break
    default:
      break
  }

  collectFallbackModuleUrls(module, urls)
}

const collectAudioSlideshowUrls = (module: ModuleDoc, urls: Set<string>) => {
  const slides = module.audioSlideshow?.slides ?? []

  if (slides.length > 0) {
    slides.forEach((slide) => {
      addMediaUrl(slide?.image, urls)
      addMediaUrl(slide?.audio, urls)
      collectLexicalMedia(slide?.body, urls)
    })
  } else {
    addMediaUrl(module.image, urls)
    addMediaUrl(module.audio, urls)
  }

  collectLexicalMedia(module.audioSlideshow?.transcript, urls)
}

const collectAudioPlaylistUrls = (module: ModuleDoc, urls: Set<string>) => {
  const audioContent = isAudioPlaylist(module.audio) ? module.audio : null

  if (audioContent?.tracks) {
    audioContent.tracks.forEach((track) => {
      addMediaUrl(track?.audio, urls)
      addMediaUrl(track?.image, urls)
      collectLexicalMedia(track?.transcript, urls)
    })
  }

  collectLexicalMedia(audioContent?.introduction, urls)
}

const collectVideoModuleUrls = (module: ModuleDoc, urls: Set<string>) => {
  const videoContent = module.video ?? null

  addMediaUrl(videoContent?.posterImage ?? module.image, urls)

  const fileUrl = resolveMediaUrl(videoContent?.videoFile ?? null)
  if (fileUrl) {
    urls.add(fileUrl)
  } else if (typeof videoContent?.streamUrl === "string") {
    const normalized = videoContent.streamUrl.trim()
    // Only cache streamUrl if it's from our own server (not YouTube, Vimeo, etc.)
    // and not an HLS manifest (which can't be cached as a single file)
    if (normalized && !normalized.toLowerCase().endsWith(".m3u8") && isCacheableUrl(normalized)) {
      const resolvedStream = resolveMediaUrl(normalized)
      if (resolvedStream) {
        urls.add(resolvedStream)
      }
    }
  }

  videoContent?.captions?.forEach((caption) => {
    addMediaUrl(caption?.file, urls)
  })

  collectLexicalMedia(videoContent?.transcript, urls)
}

const collectRichPostUrls = (module: ModuleDoc, urls: Set<string>) => {
  const content = module.richPost ?? null

  content?.mediaGallery?.forEach((entry) => {
    addMediaUrl(entry?.media, urls)
  })

  collectLexicalMedia(content?.body, urls)
}

const collectFallbackModuleUrls = (module: ModuleDoc, urls: Set<string>) => {
  addMediaUrl(module.image, urls)
  addMediaUrl(module.audio, urls)
  collectLexicalMedia(module.body as LexicalRichText | null | undefined, urls)
}

const addMediaUrl = (candidate: unknown, urls: Set<string>) => {
  const resolved = resolveUnknownMedia(candidate)
  if (resolved && isCacheableUrl(resolved)) {
    urls.add(resolved)
  }
}

const resolveUnknownMedia = (value: unknown): string | null => {
  if (!value) {
    return null
  }

  if (typeof value === "string") {
    return resolveMediaUrl(value)
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>

    if (typeof record.url === "string" || typeof record.filename === "string") {
      const mediaDoc: MediaDoc = {
        id: typeof record.id === "string" ? record.id : "inline-media",
        url: typeof record.url === "string" ? record.url : undefined,
        filename: typeof record.filename === "string" ? record.filename : undefined,
        mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined,
      }
      return resolveMediaUrl(mediaDoc)
    }

  const nestedCandidates = [record.media, record.image, record.asset, record.fields, record.value, record.src, record.file]
    for (const candidate of nestedCandidates) {
      const nested = resolveUnknownMedia(candidate)
      if (nested) {
        return nested
      }
    }
  }

  return null
}

const collectLexicalMedia = (body: LexicalRichText | null | undefined, urls: Set<string>) => {
  const rootChildren = body?.root?.children
  if (!Array.isArray(rootChildren)) {
    return
  }

  const walk = (nodes: unknown[]) => {
    nodes.forEach((node) => {
      if (!node || typeof node !== "object") {
        return
      }

      addMediaUrl(node as Record<string, unknown>, urls)

      const typed = node as { children?: unknown[] }
      if (Array.isArray(typed.children)) {
        walk(typed.children)
      }
    })
  }

  walk(rootChildren as unknown[])
}

const isAudioPlaylist = (value: ModuleDoc["audio"]): value is AudioContent => {
  return Boolean(value && typeof value === "object" && "tracks" in value)
}
