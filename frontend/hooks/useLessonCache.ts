import { useCallback, useEffect, useState } from "react"
import { Alert } from "react-native"
import { useTranslation } from "react-i18next"
import type { LessonDoc } from "@/lib/payload"
import { collectLessonMediaUrls } from "@/lib/lesson-media"
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
  const [isRedownloading, setIsRedownloading] = useState(false)

  // Cache media files (images and audio) for offline access
  const cacheMediaFiles = useCallback(async (lessonData: LessonDoc) => {
    if (!lessonData.updatedAt) {
      console.log("[useLessonCache] No updatedAt timestamp, skipping cache")
      return
    }

    const mediaUrls = collectLessonMediaUrls(lessonData)
    console.log(`[useLessonCache] Found ${mediaUrls.length} media URLs to cache`)

    if (mediaUrls.length === 0) {
      setCachedMedia({})
      setLessonCacheStatus("none")
      setCachingInProgress(false)
      return
    }

    setCachingInProgress(true)
    setLessonCacheStatus("downloading")
    const version = lessonData.updatedAt
    const cached: Record<string, string> = {}

    try {
      await Promise.all(
        mediaUrls.map(async (url) => {
          try {
            console.log(`[useLessonCache] Caching: ${url}`)
            const localPath = await getOrDownloadFile(
              url,
              version,
              false,
              (progress) => {
                setDownloadProgress((prev) => ({ ...prev, [url]: progress }))
              }
            )
            cached[url] = localPath
            console.log(`[useLessonCache] Cached successfully: ${url} -> ${localPath}`)
            setDownloadProgress((prev) => {
              const next = { ...prev }
              delete next[url]
              return next
            })
          } catch (error) {
            console.error(`[useLessonCache] Failed to cache ${url}:`, error)
          }
        })
      )

      setCachedMedia(cached)
      console.log(`[useLessonCache] Cached ${Object.keys(cached).length}/${mediaUrls.length} files`)

      try {
        const status = await getLessonCacheStatus(mediaUrls, version)
        console.log(`[useLessonCache] Cache status: ${status.status} (${status.cachedCount}/${status.totalCount})`)
        setLessonCacheStatus(status.status)
      } catch (error) {
        console.error("[useLessonCache] Failed to get cache status:", error)
        setLessonCacheStatus("none")
      }
    } catch (error) {
      console.error("[useLessonCache] Cache operation failed:", error)
      setLessonCacheStatus("none")
    } finally {
      console.log("[useLessonCache] Caching complete, setting cachingInProgress to false")
      setCachingInProgress(false)
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
              const mediaUrls = collectLessonMediaUrls(lesson)

              await clearLessonCache(mediaUrls)
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

    // Prevent duplicate redownload operations
    if (isRedownloading) {
      console.log("Redownload already in progress, ignoring duplicate request")
      return
    }

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
              setIsRedownloading(true)
              setCacheMenuVisible(false)
              setCachingInProgress(true)
              setLessonCacheStatus("downloading")

              const mediaUrls = collectLessonMediaUrls(lesson)

              await redownloadLessonMedia(mediaUrls, lesson.updatedAt!, (url, progress) => {
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
              setIsRedownloading(false)
            }
          },
        },
      ]
    )
  }, [lesson, t, cacheMediaFiles, isRedownloading])

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

