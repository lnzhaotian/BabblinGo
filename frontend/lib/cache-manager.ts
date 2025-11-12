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
  try {
    if (!CACHE_DIR.exists) {
      await CACHE_DIR.create();
    }
  } catch (error) {
    console.error('[cache-manager] Failed to ensure cache directory:', error);
    throw error;
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
 * @param version - Server version (optional - if not provided, any cached version is accepted)
 * @returns Local file path if cached and up-to-date, null otherwise
 */
export async function getCachedFile(
  url: string,
  version?: string
): Promise<string | null> {
  try {
    const index = await getCacheIndex();
    const cacheKey = getCacheKey(url);
    const cached = index[cacheKey];

    if (!cached) {
      return null;
    }

    // Check if file still exists
    const file = new File(cached.localPath);
    if (!file.exists) {
      // Remove from index with lock to prevent race conditions
      await withCacheIndexLock(async () => {
        const currentIndex = await getCacheIndex();
        delete currentIndex[cacheKey];
        await saveCacheIndex(currentIndex);
      });
      return null;
    }

    return cached.localPath;
  } catch (error) {
    console.error('[cache-manager] Failed to check cache:', error);
    return null;
  }
}

// Track ongoing downloads to prevent duplicates
const activeDownloads = new Map<string, Promise<string>>();

/**
 * Download and cache a file
 * @param url - Remote file URL
 * @param version - Server version (optional - used for tracking but not validation)
 * @param onProgress - Progress callback (0-1)
 * @returns Local file path
 */
export async function downloadAndCache(
  url: string,
  version?: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const cacheKey = getCacheKey(url);
  
  // First check if already cached and valid
  const existingCache = await getCachedFile(url, version);
  if (existingCache) {
    onProgress?.(1.0);
    return existingCache;
  }
  
  // Check if this URL is already being downloaded
  const existingDownload = activeDownloads.get(cacheKey);
  if (existingDownload) {
    return await existingDownload;
  }

  // Create download promise
  const downloadPromise = (async () => {
    try {
      await ensureCacheDir();

      // Use cache key as filename to ensure uniqueness, append original extension
      const originalFilename = url.split('/').pop() || '';
      const extension = originalFilename.includes('.') 
        ? '.' + originalFilename.split('.').pop() 
        : '';
      const filename = cacheKey + extension;
      const targetFile = new File(CACHE_DIR, filename);

      // Check if file already exists from a previous partial/failed download
      if (targetFile.exists) {
        try {
          await targetFile.delete();
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch {
          throw new Error(`Cannot delete existing file: ${targetFile.uri}`);
        }
      }

      // Download the file
      const downloadedFile = await File.downloadFileAsync(url, CACHE_DIR);

      // Rename file to use our custom naming scheme
      const finalPath = targetFile.uri;
      let finalFile = downloadedFile;
      
      if (downloadedFile.uri !== finalPath) {
        if (targetFile.exists) {
          // Target already exists, delete temp download
          await downloadedFile.delete();
          finalFile = targetFile;
        } else {
          // Rename to target
          try {
            await downloadedFile.move(targetFile);
            finalFile = targetFile;
          } catch {
            finalFile = downloadedFile;
          }
        }
      }

      // Call progress callback with 100% after completion
      if (onProgress) {
        onProgress(1.0);
      }

      // Update cache index with lock to prevent race conditions
      await withCacheIndexLock(async () => {
        const index = await getCacheIndex();
        const existingEntry = index[cacheKey];
        
        // If entry already exists and points to a valid file, don't overwrite
        if (existingEntry && existingEntry.version === version) {
          const existingFile = new File(existingEntry.localPath);
          if (existingFile.exists) {
            return;
          }
        }
        
        index[cacheKey] = {
          url,
          localPath: finalFile.uri,
          version: version || url,
          downloadedAt: Date.now(),
          size: finalFile.size || 0,
        };
        await saveCacheIndex(index);
      });

      return finalFile.uri;
    } catch (error) {
      console.error(`[cache-manager] Download failed:`, error);
      // Clean up partial download if exists
      try {
        const originalFilename = url.split('/').pop() || '';
        const extension = originalFilename.includes('.') 
          ? '.' + originalFilename.split('.').pop() 
          : '';
        const filename = cacheKey + extension;
        const targetFile = new File(CACHE_DIR, filename);
        if (targetFile.exists) {
          await targetFile.delete();
        }
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    } finally {
      // Remove from active downloads
      activeDownloads.delete(cacheKey);
    }
  })();

  // Store the download promise
  activeDownloads.set(cacheKey, downloadPromise);
  
  return downloadPromise;
}

/**
 * Get or download a file (with caching)
 */
export async function getOrDownloadFile(
  url: string,
  version?: string,
  forceDownload: boolean = false,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!forceDownload) {
    const cached = await getCachedFile(url, version);
    if (cached) {
      onProgress?.(1);
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
 * @param version - Expected version (optional - not used for validation, kept for compatibility)
 * @returns Cache status information
 */
export async function getLessonCacheStatus(
  mediaUrls: string[],
  version?: string
): Promise<LessonCacheInfo> {
  const index = await getCacheIndex();
  let cachedCount = 0;
  let cachedSize = 0;

  for (const url of mediaUrls) {
    const cacheKey = getCacheKey(url);
    const cached = index[cacheKey];

    if (cached) {
      // Verify file still exists (don't check version - URL is the source of truth)
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

    for (const url of mediaUrls) {
      const cacheKey = getCacheKey(url);
      const cached = index[cacheKey];

      // Clear any ongoing downloads for this URL
      if (activeDownloads.has(cacheKey)) {
        activeDownloads.delete(cacheKey);
      }

      if (cached) {
        try {
          const file = new File(cached.localPath);
          if (file.exists) {
            await file.delete();
          }
          delete index[cacheKey];
        } catch (error) {
          console.error(`[cache-manager] Failed to delete cached file:`, error);
        }
      }
    }

    await saveCacheIndex(index);
  });
}

/**
 * Force re-download all media for a lesson
 * @param mediaUrls - Array of media URLs
 * @param version - Current version (optional - used for tracking)
 * @param onProgress - Progress callback (url, progress)
 */
export async function redownloadLessonMedia(
  mediaUrls: string[],
  version?: string,
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

