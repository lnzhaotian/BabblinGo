import { useCallback, useEffect, useState } from "react"
import { Alert } from "react-native"
import { useTranslation } from "react-i18next"
import type { LessonDoc } from "@/lib/payload"
import { extractModules, resolveMediaUrl } from "@/lib/payload"
import {
  getOrDownloadFile,
  getLessonCacheStatus,
  clearLessonCache,
  redownloadLessonMedia,
  type LessonCacheStatus,
} from "@/lib/cache-manager"

/**
 * Custom hook for managing lesson media caching
 * 
 * - Automatically caches lesson media when lesson data is provided
 * - Tracks download progress and cache status
 * - Provides handlers for clearing and re-downloading cache
 */
export function useLessonCache(lesson: LessonDoc | null) {
  const { t } = useTranslation()
  const [cachedMedia, setCachedMedia] = useState<Record<string, string>>({}) // URL -> local path
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({}) // URL -> progress (0-1)
  const [cachingInProgress, setCachingInProgress] = useState(false)
  const [lessonCacheStatus, setLessonCacheStatus] = useState<LessonCacheStatus>("none")
  const [cacheMenuVisible, setCacheMenuVisible] = useState(false)

  // Cache media files (images and audio) for offline access
  const cacheMediaFiles = useCallback(async (lessonData: LessonDoc) => {
    if (!lessonData.updatedAt) return

    setCachingInProgress(true)
    const version = lessonData.updatedAt
    const modulesList = extractModules(lessonData)
    const cached: Record<string, string> = {}

    // Collect all media URLs
  const mediaUrls = new Set<string>()

    for (const module of modulesList) {
      const imageUrl = resolveMediaUrl(module.image)
      const audioUrl = resolveMediaUrl(module.audio)

      if (imageUrl) mediaUrls.add(imageUrl)
      if (audioUrl) mediaUrls.add(audioUrl)
    }

    // Download all files in parallel
    await Promise.all(
      Array.from(mediaUrls).map(async (url) => {
        try {
          const localPath = await getOrDownloadFile(
            url,
            version,
            false, // Don't force download if cached
            (progress) => {
              setDownloadProgress((prev) => ({ ...prev, [url]: progress }))
            }
          )
          cached[url] = localPath
          // Clear progress indicator once complete
          setDownloadProgress((prev) => {
            const next = { ...prev }
            delete next[url]
            return next
          })
        } catch (error) {
          console.error(`Failed to cache ${url}:`, error)
        }
      })
    )

    setCachedMedia(cached)
    setCachingInProgress(false)

    // Update cache status
    const allUrls = Array.from(mediaUrls)

    if (allUrls.length > 0) {
      try {
        const status = await getLessonCacheStatus(allUrls, version)
        setLessonCacheStatus(status.status)
      } catch (error) {
        console.error("Failed to get cache status:", error)
      }
    }
  }, [])

  // Handle clearing cache for this lesson
  const handleClearCache = useCallback(async () => {
    if (!lesson || !lesson.updatedAt) return

    Alert.alert(
      t("lesson.cache.clearTitle") || "Clear Cache?",
      t("lesson.cache.clearMessage") || "This will delete all cached media for this lesson.",
      [
        { text: t("common.cancel") || "Cancel", style: "cancel" },
        {
          text: t("common.clear") || "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const modulesList = extractModules(lesson)
              const mediaUrls = new Set<string>()

              for (const module of modulesList) {
                const imageUrl = resolveMediaUrl(module.image)
                const audioUrl = resolveMediaUrl(module.audio)
                if (imageUrl) mediaUrls.add(imageUrl)
                if (audioUrl) mediaUrls.add(audioUrl)
              }

              await clearLessonCache(Array.from(mediaUrls))
              setCachedMedia({})
              setLessonCacheStatus("none")
              setCacheMenuVisible(false)
              Alert.alert(
                t("lesson.cache.cleared") || "Cache Cleared",
                t("lesson.cache.clearedMessage") || "Media files have been removed."
              )
            } catch (error) {
              console.error("Failed to clear cache:", error)
              Alert.alert(
                t("common.error") || "Error",
                t("lesson.cache.clearError") || "Failed to clear cache."
              )
            }
          },
        },
      ]
    )
  }, [lesson, t])

  // Handle re-downloading all media
  const handleRedownload = useCallback(async () => {
    if (!lesson || !lesson.updatedAt) return

    Alert.alert(
      t("lesson.cache.redownloadTitle") || "Re-download Media?",
      t("lesson.cache.redownloadMessage") ||
        "This will download fresh copies of all media files.",
      [
        { text: t("common.cancel") || "Cancel", style: "cancel" },
        {
          text: t("lesson.cache.redownload") || "Re-download",
          onPress: async () => {
            try {
              setCacheMenuVisible(false)
              setCachingInProgress(true)
              setLessonCacheStatus("downloading")

              const modulesList = extractModules(lesson)
              const mediaUrls = new Set<string>()

              for (const module of modulesList) {
                const imageUrl = resolveMediaUrl(module.image)
                const audioUrl = resolveMediaUrl(module.audio)
                if (imageUrl) mediaUrls.add(imageUrl)
                if (audioUrl) mediaUrls.add(audioUrl)
              }

              await redownloadLessonMedia(Array.from(mediaUrls), lesson.updatedAt!, (url, progress) => {
                setDownloadProgress((prev) => ({ ...prev, [url]: progress }))
              })

              // Reload cached media
              await cacheMediaFiles(lesson)
            } catch (error) {
              console.error("Failed to redownload:", error)
              Alert.alert(
                t("common.error") || "Error",
                t("lesson.cache.redownloadError") || "Failed to re-download media."
              )
            } finally {
              setCachingInProgress(false)
            }
          },
        },
      ]
    )
  }, [lesson, t, cacheMediaFiles])

  // Cache media after lesson loads
  useEffect(() => {
    if (lesson) {
      cacheMediaFiles(lesson)
    }
  }, [lesson, cacheMediaFiles])

  return {
    cachedMedia,
    downloadProgress,
    cachingInProgress,
    lessonCacheStatus,
    cacheMenuVisible,
    setCacheMenuVisible,
    handleClearCache,
    handleRedownload,
  }
}
