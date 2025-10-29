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
      // Delete the old file to allow fresh download
      await targetFile.delete();
    }

    // Use the static download method
    const downloadedFile = await File.downloadFileAsync(url, CACHE_DIR);

    // Call progress callback with 100% after completion
    if (onProgress) {
      onProgress(1.0);
    }

    // Update cache index
    const index = await getCacheIndex();
    index[cacheKey] = {
      url,
      localPath: downloadedFile.uri,
      version,
      downloadedAt: Date.now(),
      size: downloadedFile.size || 0,
    };
    await saveCacheIndex(index);

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
      console.log(`Using cached file: ${cached}`);
      onProgress?.(1); // Already complete
      return cached;
    }
  }

  console.log(`Downloading file: ${url}`);
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
}

