# Cache System Testing Checklist

## 🧪 Manual Testing Steps

### 1. First-Time Download
- [ ] Open a lesson for the first time
- [ ] Verify spinner appears in header during download
- [ ] Verify progress indicator shows on images (0% → 100%)
- [ ] Verify images and audio load correctly
- [ ] Check Settings → Cache shows increased file count and size

**Expected Result**: Media downloads with progress indicators, then displays normally.

---

### 2. Cached Content Loading
- [ ] Close and reopen the same lesson
- [ ] Verify NO spinner in header (already cached)
- [ ] Verify NO progress indicators on images
- [ ] Verify images and audio load instantly from cache

**Expected Result**: Instant loading, no download indicators.

---

### 3. Cache Statistics
- [ ] Open Settings tab
- [ ] Verify "Media Cache" section displays
- [ ] Check file count matches number of downloaded files
- [ ] Check size is reasonable (not 0, not absurdly large)
- [ ] Tap "Refresh" button
- [ ] Verify stats update (should be same if nothing changed)

**Expected Result**: Accurate statistics displayed and refreshable.

---

### 4. Clear Cache
- [ ] In Settings, tap "Clear" button
- [ ] Verify confirmation dialog appears
- [ ] Tap "Cancel" → verify nothing happens
- [ ] Tap "Clear" again, then confirm
- [ ] Verify success message appears
- [ ] Verify file count and size now show 0

**Expected Result**: Cache cleared with confirmation, stats reset to zero.

---

### 5. Re-download After Clear
- [ ] After clearing cache, reopen a previously viewed lesson
- [ ] Verify download indicators appear again (like first time)
- [ ] Verify media re-downloads successfully
- [ ] Check Settings → Cache stats increase again

**Expected Result**: Media re-downloads as if first time.

---

### 6. Update Detection (Backend Test)
- [ ] Open a lesson and let it cache
- [ ] In Payload CMS admin, edit one of the lesson's modules
- [ ] Change the image or audio file
- [ ] Save the module (this updates `updatedAt`)
- [ ] In app, reopen the lesson
- [ ] Verify the download indicator appears again
- [ ] Verify the new media is downloaded and displayed

**Expected Result**: Outdated cache detected, new version downloaded automatically.

---

### 7. Multiple Lessons
- [ ] Open 3-4 different lessons
- [ ] Let each one cache fully
- [ ] Check Settings → Cache stats show total from all lessons
- [ ] Close and reopen each lesson
- [ ] Verify all load instantly from cache

**Expected Result**: Multiple lessons cached independently, all accessible.

---

### 8. Network Error Handling
- [ ] Turn off WiFi/cellular data
- [ ] Try to open a new lesson (not cached)
- [ ] Verify graceful error (not cached, can't download)
- [ ] Turn network back on
- [ ] Refresh/reopen the lesson
- [ ] Verify successful download

**Expected Result**: Graceful fallback, no crashes.

---

### 9. Language Switching
- [ ] Switch app language from English to Chinese
- [ ] Open Settings
- [ ] Verify cache section labels in Chinese:
  - "媒体缓存"
  - "已缓存的媒体文件，可离线访问"
  - "文件数", "大小"
  - "刷新", "清除"
- [ ] Switch back to English
- [ ] Verify labels return to English

**Expected Result**: All cache UI fully translated.

---

### 10. Edge Cases

#### Empty Cache
- [ ] Clear cache completely
- [ ] Open Settings → Cache section
- [ ] Verify shows "0 files, 0 B"
- [ ] Verify "Clear" button is disabled (grey, unclickable)

#### Large Media Files
- [ ] Upload a large image (5+ MB) to a module in CMS
- [ ] Open that lesson in app
- [ ] Verify progress indicator works for large files
- [ ] Verify eventual successful cache

#### Rapid Navigation
- [ ] Quickly open and close multiple lessons
- [ ] Verify no race conditions or crashes
- [ ] Check cache stats remain accurate

**Expected Result**: Robust handling of edge cases.

---

## 🔍 Debug Checks

### Console Logs to Monitor
```bash
# Look for these in Metro/Xcode/Android Studio logs:
- "Using cached file: [path]" (cache hit)
- "Downloading file: [url]" (cache miss)
- "Download progress: X%" (progress tracking)
- "Cache cleared" (successful clear)
- "Failed to cache [url]:" (errors)
```

### AsyncStorage Inspection
```typescript
// Check cache index structure
AsyncStorage.getItem('@babblingo:cache_index').then(console.log)

// Should show something like:
{
  "encoded_url_1": {
    "url": "https://...",
    "localPath": "file:///...",
    "version": "2024-10-29T10:30:00.000Z",
    "downloadedAt": 1730197800000,
    "size": 524288
  }
}
```

### File System Inspection (iOS Simulator)
```bash
# Find cache directory
~/Library/Developer/CoreSimulator/Devices/[UUID]/data/Containers/Data/Application/[UUID]/Library/Caches/media/

# List cached files
ls -lah [cache_path]
```

---

## 🎯 Success Criteria

All tests should pass with:
- ✅ No crashes or errors
- ✅ Accurate progress tracking
- ✅ Instant cache loading
- ✅ Correct update detection
- ✅ Reliable cache clearing
- ✅ Proper UI translations
- ✅ Graceful error handling

---

## 🐛 Known Limitations

1. **No network status detection**: Cache tries to download even on cellular data
2. **No size limits**: Cache can grow indefinitely
3. **No preloading**: Downloads happen on lesson open, not in background
4. **No per-lesson cache toggle**: All lessons cached automatically

These are intentional simplifications for MVP. Can be enhanced later.

---

## 📝 Test Log Template

```
Date: __________
Tester: __________
Device: __________ (iOS/Android, version)

Test #1: First-Time Download
Result: ☐ Pass ☐ Fail
Notes: ___________________________

Test #2: Cached Content Loading
Result: ☐ Pass ☐ Fail
Notes: ___________________________

[Continue for all tests...]

Overall Result: ☐ All Pass ☐ Some Failures

Critical Issues Found:
1. ___________________________
2. ___________________________
```

---

## 🚀 Ready for Production?

Before deploying to production, ensure:
- [ ] All manual tests pass
- [ ] No console errors during normal usage
- [ ] Translations verified by native speakers
- [ ] Backend `updatedAt` field populated for all lessons
- [ ] Adequate server bandwidth for initial downloads
- [ ] Cache storage limits acceptable for target devices

**When all checked**: 🟢 READY TO DEPLOY
