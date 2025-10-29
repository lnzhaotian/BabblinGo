import { Paths, File, Directory } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache metadata structure
interface CacheMetadata {
  url: string;
  localPath: string;
  version: string; // updatedAt timestamp from server
  downloadedAt: number;
  size: number;
}

interface CacheIndex {
  [key: string]: CacheMetadata;
}

// Cache directory
const CACHE_DIR = new Directory(Paths.cache, 'media');
const CACHE_INDEX_KEY = '@babblingo:cache_index';

// Simple mutex to prevent race conditions when updating cache index
let cacheIndexLock: Promise<void> = Promise.resolve();

/**
 * Acquire lock for cache index operations
 */
async function withCacheIndexLock<T>(fn: () => Promise<T>): Promise<T> {
  const currentLock = cacheIndexLock;
  let releaseLock: () => void;
  
  cacheIndexLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  try {
    await currentLock;
    return await fn();
  } finally {
    releaseLock!();
  }
}

/**
 * Initialize cache directory
 */
async function ensureCacheDir() {
  if (!CACHE_DIR.exists) {
    await CACHE_DIR.create();
  }
}

/**
 * Get cache index from AsyncStorage
 */
async function getCacheIndex(): Promise<CacheIndex> {
  try {
    const indexJson = await AsyncStorage.getItem(CACHE_INDEX_KEY);
    return indexJson ? JSON.parse(indexJson) : {};
  } catch (error) {
    console.error('Failed to get cache index:', error);
    return {};
  }
}

/**
 * Save cache index to AsyncStorage
 */
async function saveCacheIndex(index: CacheIndex): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
  } catch (error) {
    console.error('Failed to save cache index:', error);
  }
}

/**
 * Generate cache key from URL
 */
function getCacheKey(url: string): string {
  // Use URL as key, encode to be filesystem-safe
  return encodeURIComponent(url.replace(/[^a-zA-Z0-9]/g, '_'));
}

/**
 * Check if a file is cached and up-to-date
 * @param url - Remote file URL
 * @param version - Server version (updatedAt timestamp)
 * @returns Local file path if cached and up-to-date, null otherwise
 */
export async function getCachedFile(
  url: string,
  version: string
): Promise<string | null> {
  try {
    const index = await getCacheIndex();
    const cacheKey = getCacheKey(url);
    const cached = index[cacheKey];

    if (!cached) {
      return null; // Not cached
    }

    // Check if version matches
    if (cached.version !== version) {
      console.log(`Cache outdated for ${url}: ${cached.version} vs ${version}`);
      return null; // Outdated
    }

    // Check if file still exists
    const file = new File(cached.localPath);
    if (!file.exists) {
      console.log(`Cache file missing: ${cached.localPath}`);
      // Remove from index
      delete index[cacheKey];
      await saveCacheIndex(index);
      return null;
    }

    return cached.localPath;
  } catch (error) {
    console.error('Failed to check cache:', error);
    return null;
  }
}

/**
 * Download and cache a file
 * @param url - Remote file URL
 * @param version - Server version (updatedAt timestamp)
 * @param onProgress - Progress callback (0-1)
 * @returns Local file path
 */
export async function downloadAndCache(
  url: string,
  version: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  await ensureCacheDir();

  const cacheKey = getCacheKey(url);
  const filename = url.split('/').pop() || cacheKey;
  const targetFile = new File(CACHE_DIR, filename);

  try {
    // Check if file already exists from a previous partial/failed download
    if (targetFile.exists) {
      await targetFile.delete();
    }

    // Use the static download method
    const downloadedFile = await File.downloadFileAsync(url, CACHE_DIR);

    // Call progress callback with 100% after completion
    if (onProgress) {
      onProgress(1.0);
    }

    // Update cache index with lock to prevent race conditions
    await withCacheIndexLock(async () => {
      const index = await getCacheIndex();
      index[cacheKey] = {
        url,
        localPath: downloadedFile.uri,
        version,
        downloadedAt: Date.now(),
        size: downloadedFile.size || 0,
      };
      await saveCacheIndex(index);
    });

    return downloadedFile.uri;
  } catch (error) {
    // Clean up partial download if exists
    try {
      if (targetFile.exists) {
        await targetFile.delete();
      }
    } catch {
      // Ignore cleanup errors
    }
    console.error('Download failed:', error);
    throw error;
  }
}

/**
 * Get or download a file (with caching)
 * @param url - Remote file URL
 * @param version - Server version (updatedAt timestamp)
 * @param forceDownload - Skip cache and always download fresh
 * @param onProgress - Progress callback (0-1)
 * @returns Local file path (cached or freshly downloaded)
 */
export async function getOrDownloadFile(
  url: string,
  version: string,
  forceDownload: boolean = false,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!forceDownload) {
    const cached = await getCachedFile(url, version);
    if (cached) {
      onProgress?.(1); // Already complete
      return cached;
    }
  }

  return downloadAndCache(url, version, onProgress);
}

/**
 * Clear all cached files
 */
export async function clearCache(): Promise<void> {
  try {
    if (CACHE_DIR.exists) {
      await CACHE_DIR.delete();
      await CACHE_DIR.create();
    }
    await AsyncStorage.removeItem(CACHE_INDEX_KEY);
    console.log('Cache cleared');
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  fileCount: number;
  totalSize: number;
  files: CacheMetadata[];
}> {
  const index = await getCacheIndex();
  const files = Object.values(index);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  return {
    fileCount: files.length,
    totalSize,
    files,
  };
}

/**
 * Delete a specific cached file
 */
export async function deleteCachedFile(url: string): Promise<void> {
  await withCacheIndexLock(async () => {
    try {
      const index = await getCacheIndex();
      const cacheKey = getCacheKey(url);
      const cached = index[cacheKey];

      if (cached) {
        const file = new File(cached.localPath);
        if (file.exists) {
          await file.delete();
        }
        delete index[cacheKey];
        await saveCacheIndex(index);
        console.log(`Deleted cached file: ${url}`);
      }
    } catch (error) {
      console.error('Failed to delete cached file:', error);
    }
  });
}

/**
 * Cache status for a lesson
 */
export type LessonCacheStatus = 'full' | 'partial' | 'none' | 'downloading';

export interface LessonCacheInfo {
  status: LessonCacheStatus;
  cachedCount: number;
  totalCount: number;
  cachedSize: number;
  urls: string[];
}

/**
 * Get cache status for a specific lesson
 * @param mediaUrls - Array of media URLs from the lesson
 * @param version - Expected version (lesson.updatedAt)
 * @returns Cache status information
 */
export async function getLessonCacheStatus(
  mediaUrls: string[],
  version: string
): Promise<LessonCacheInfo> {
  const index = await getCacheIndex();
  let cachedCount = 0;
  let cachedSize = 0;

  for (const url of mediaUrls) {
    const cacheKey = getCacheKey(url);
    const cached = index[cacheKey];

    if (cached && cached.version === version) {
      // Verify file still exists
      const file = new File(cached.localPath);
      if (file.exists) {
        cachedCount++;
        cachedSize += cached.size;
      }
    }
  }

  const totalCount = mediaUrls.length;
  let status: LessonCacheStatus = 'none';

  if (cachedCount === 0) {
    status = 'none';
  } else if (cachedCount === totalCount) {
    status = 'full';
  } else {
    status = 'partial';
  }

  return {
    status,
    cachedCount,
    totalCount,
    cachedSize,
    urls: mediaUrls,
  };
}

/**
 * Clear all cached files for a specific lesson
 * @param mediaUrls - Array of media URLs from the lesson
 */
export async function clearLessonCache(mediaUrls: string[]): Promise<void> {
  await withCacheIndexLock(async () => {
    const index = await getCacheIndex();
    let deletedCount = 0;

    for (const url of mediaUrls) {
      const cacheKey = getCacheKey(url);
      const cached = index[cacheKey];

      if (cached) {
        try {
          const file = new File(cached.localPath);
          if (file.exists) {
            await file.delete();
            deletedCount++;
          }
          delete index[cacheKey];
        } catch (error) {
          console.error(`Failed to delete ${url}:`, error);
        }
      }
    }

    await saveCacheIndex(index);
    console.log(`Cleared ${deletedCount} cached files for lesson`);
  });
}

/**
 * Force re-download all media for a lesson
 * @param mediaUrls - Array of media URLs
 * @param version - Current version
 * @param onProgress - Progress callback (url, progress)
 */
export async function redownloadLessonMedia(
  mediaUrls: string[],
  version: string,
  onProgress?: (url: string, progress: number) => void
): Promise<void> {
  // First clear existing cache
  await clearLessonCache(mediaUrls);

  // Then download all files
  await Promise.all(
    mediaUrls.map(async (url) => {
      try {
        await downloadAndCache(url, version, (progress) => {
          onProgress?.(url, progress);
        });
      } catch (error) {
        console.error(`Failed to redownload ${url}:`, error);
      }
    })
  );
}

