# Cache Manager Usage Guide

The cache manager provides efficient local caching of media files (images, audio) with version tracking and automatic update detection.

## Features

- ✅ **Version Tracking**: Detects when server content is updated
- ✅ **Progress Tracking**: Real-time download progress callbacks
- ✅ **Smart Caching**: Only re-downloads when content changes
- ✅ **Metadata Storage**: Tracks download time, file size, versions
- ✅ **Cache Management**: Clear all or individual cached files

## Basic Usage

### 1. Download and Cache a File

```typescript
import { getOrDownloadFile } from '@/lib/cache-manager';

// In your lesson screen
const imageUrl = module.image?.url;
const version = lesson.updatedAt; // Use lesson's updatedAt as version

const localPath = await getOrDownloadFile(
  imageUrl,
  version,
  false, // Don't force download if cached
  (progress) => {
    // Update UI with download progress
    setDownloadProgress(progress);
  }
);

// Use the local path in your Image component
<Image source={{ uri: localPath }} />
```

### 2. Check if File is Cached

```typescript
import { getCachedFile } from '@/lib/cache-manager';

const cached = await getCachedFile(imageUrl, version);

if (cached) {
  // File is cached and up-to-date
  console.log('Using cached file:', cached);
} else {
  // Need to download
  console.log('File not cached or outdated');
}
```

### 3. Force Re-download

```typescript
// Useful for "Refresh" button
const localPath = await getOrDownloadFile(
  imageUrl,
  version,
  true, // Force download even if cached
  (progress) => setProgress(progress)
);
```

### 4. Get Cache Statistics

```typescript
import { getCacheStats } from '@/lib/cache-manager';

const stats = await getCacheStats();

console.log(`Cached files: ${stats.fileCount}`);
console.log(`Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);

// List all cached files
stats.files.forEach(file => {
  console.log(`${file.url} - ${file.size} bytes`);
});
```

### 5. Clear All Cache

```typescript
import { clearCache } from '@/lib/cache-manager';

// In settings screen
await clearCache();
console.log('Cache cleared!');
```

### 6. Delete Specific File

```typescript
import { deleteCachedFile } from '@/lib/cache-manager';

await deleteCachedFile(imageUrl);
```

## Integration Example: Lesson Screen

```typescript
import { useEffect, useState } from 'react';
import { getOrDownloadFile } from '@/lib/cache-manager';

export default function LessonScreen({ lesson }) {
  const [modules, setModules] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    async function loadModules() {
      const modulesWithCache = await Promise.all(
        lesson.modules.map(async (module) => {
          // Cache image
          if (module.image?.url) {
            const imagePath = await getOrDownloadFile(
              module.image.url,
              lesson.updatedAt,
              false,
              (progress) => {
                setLoadingProgress(prev => ({
                  ...prev,
                  [module.id]: progress,
                }));
              }
            );
            module.image.localPath = imagePath;
          }

          // Cache audio
          if (module.audio?.url) {
            const audioPath = await getOrDownloadFile(
              module.audio.url,
              lesson.updatedAt,
              false
            );
            module.audio.localPath = audioPath;
          }

          return module;
        })
      );

      setModules(modulesWithCache);
    }

    loadModules();
  }, [lesson]);

  return (
    <View>
      {modules.map(module => (
        <View key={module.id}>
          {loadingProgress[module.id] !== undefined && 
           loadingProgress[module.id] < 1 && (
            <ProgressBar progress={loadingProgress[module.id]} />
          )}
          
          <Image source={{ uri: module.image.localPath }} />
          
          <Button 
            title="Play Audio"
            onPress={() => playAudio(module.audio.localPath)}
          />
        </View>
      ))}
    </View>
  );
}
```

## Update Detection Strategy

The cache manager uses `updatedAt` timestamps as version identifiers:

1. **On Lesson Load**: Pass `lesson.updatedAt` as the version parameter
2. **Cache Check**: Compares cached version with server version
3. **Auto-Update**: If versions differ, automatically re-downloads
4. **User Notification**: You can detect updates and prompt users:

```typescript
import { getCachedFile } from '@/lib/cache-manager';

async function checkForUpdates(lesson) {
  for (const module of lesson.modules) {
    if (module.image?.url) {
      const cached = await getCachedFile(module.image.url, lesson.updatedAt);
      
      if (!cached && previousVersion) {
        // Content was updated on server
        Alert.alert(
          'New Content Available',
          'This lesson has been updated. Download the latest version?',
          [
            { text: 'Later', style: 'cancel' },
            { 
              text: 'Update Now', 
              onPress: () => downloadUpdates(lesson) 
            },
          ]
        );
        break;
      }
    }
  }
}
```

## Storage Locations

- **Files**: `FileSystem.cacheDirectory/media/`
- **Metadata**: AsyncStorage key `@babblingo:cache_index`

## Performance Tips

1. **Parallel Downloads**: Use `Promise.all()` for multiple files
2. **Background Loading**: Download on app launch for offline access
3. **WiFi-Only** (future): Add network check before downloads
4. **Size Limits** (future): Monitor total cache size and implement LRU eviction

## Troubleshooting

### Files not downloading
- Check network connectivity
- Verify URL is accessible
- Check for CORS issues (mobile apps usually exempt)

### Cache not working
- Verify `updatedAt` is consistent format (ISO string)
- Check AsyncStorage permissions
- Ensure cache directory is writable

### High storage usage
- Call `getCacheStats()` to see total size
- Use `clearCache()` to free up space
- Consider implementing automatic cleanup of old files
