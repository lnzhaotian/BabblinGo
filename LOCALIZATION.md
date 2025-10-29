# BabblinGo Localization Guide

## Overview

The BabblinGo app now supports multi-language functionality with English and Chinese. The implementation follows a hybrid approach:
- **UI strings** (buttons, labels, navigation) are managed client-side via i18next
- **Content** (lesson titles, summaries, audio) will be managed server-side via Payload CMS

## Current Implementation Status

### ✅ Frontend (Complete)

#### i18n Infrastructure
- **Library**: i18next + react-i18next + expo-localization
- **Languages**: English (en), Chinese (zh)
- **System Integration**: Automatically detects and uses system language on first launch
- **User Control**: Language picker in Settings tab (System Default / English / 中文)
- **Persistence**: User's language preference saved to AsyncStorage

#### Translated UI Components
All UI strings have been extracted and translated:
- Tab navigation labels
- Home screen (lesson list, error messages)
- Lesson screen (navigation, loading states, errors)
- Timer modals (set timer, time up, controls)
- Player controls (speed selector)
- Progress screen (filters, charts, session history)
- Settings screen (language picker, navigation)
- Tests screen (test titles and descriptions)

#### API Integration
All API calls now include a `locale` parameter:
```typescript
// Example: Home screen fetching lessons
const locale = i18n.language; // 'en' or 'zh'
const lessons = await fetchLessonsByLevelSlug('novice', locale);
// API call: GET /api/lessons?level=novice&locale=zh
```

**Files Updated:**
- `lib/i18n.ts` - i18n configuration and translations
- `lib/payload.ts` - API functions now accept locale parameter
- `app/(tabs)/index.tsx` - Home screen passes locale when fetching lessons
- `app/(stack)/lesson/[lessonId].tsx` - Lesson screen passes locale when fetching lesson details
- `app/(tabs)/settings.tsx` - Language picker
- All other screen files - Extracted strings to translations

### ⏳ Backend (Pending)

The frontend is **ready to receive localized content** from the backend. The backend team needs to configure Payload CMS to support localization.

## Backend Implementation Guide

### Step 1: Enable Localization in Payload Config

Update `payload.config.ts`:

```typescript
import { buildConfig } from 'payload/config'

export default buildConfig({
  // ... existing config
  localization: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
    fallback: true,
  },
})
```

### Step 2: Configure Collections for Localization

For collections that need localized content (Lessons, Levels, Modules):

```typescript
// Example: courses/schemas/course.schema.ts
export const LessonSchema = {
  slug: 'lessons',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true, // ← Enable localization
    },
    {
      name: 'summary',
      type: 'textarea',
      localized: true, // ← Enable localization
    },
    {
      name: 'body',
      type: 'richText',
      localized: true, // ← Enable localization
    },
    {
      name: 'audio',
      type: 'upload',
      relationTo: 'media',
      localized: true, // ← Enable localization for audio files
    },
    // Non-localized fields
    {
      name: 'order',
      type: 'number',
      // No localized flag - same across all languages
    },
  ],
}
```

### Step 3: Fields to Localize

**Lessons Collection:**
- ✅ `title` - Lesson title displayed in lists
- ✅ `summary` - Short description shown in lesson list
- ✅ `body` - Full lesson content (if applicable)
- ✅ `audio` - Audio files (Chinese audio for zh locale)
- ❌ `order` - Same across languages
- ❌ `slug` - Same across languages

**Levels Collection:**
- ✅ `name` - Level name (e.g., "Novice" / "初级")
- ❌ `slug` - Same across languages

**Modules Collection:**
- ✅ `title` - Module title
- ✅ `body` - Module content
- ❌ `order` - Same across languages

### Step 4: API Behavior

When the frontend requests data with a locale parameter:
```
GET /api/lessons?level=novice&locale=zh
```

Payload will:
1. Return the Chinese (`zh`) version if available
2. Fall back to English (`en`) if Chinese translation doesn't exist
3. This allows gradual translation without breaking the app

### Step 5: Content Management Workflow

Once localization is enabled:

1. **Content Editors** will see language tabs in the admin panel:
   ```
   [ English ] [ 中文 ]
   ```

2. **Creating Content:**
   - Create lesson in English first (default)
   - Switch to 中文 tab to add Chinese translation
   - Upload separate Chinese audio file

3. **Testing:**
   - Test with `?locale=en` → Should return English content
   - Test with `?locale=zh` → Should return Chinese content (or fallback to English if not translated)

## Testing Localization

### Frontend Testing (Already Working)

1. **Change Language in App:**
   - Open Settings tab
   - Tap Language → Select "中文"
   - Navigate back to Home → UI should be in Chinese

2. **Verify API Calls:**
   - Open browser dev tools or React Native debugger
   - Change language in Settings
   - Reload Home screen
   - Check network tab: API calls should include `?locale=zh`

### Backend Testing (After Implementation)

1. **Create Test Lesson:**
   - Create lesson "Hello" in English
   - Add Chinese translation "你好"
   - Upload English and Chinese audio

2. **Test API:**
   ```bash
   # Should return English
   curl http://localhost:3000/api/lessons/123?locale=en
   
   # Should return Chinese
   curl http://localhost:3000/api/lessons/123?locale=zh
   ```

3. **Test Fallback:**
   - Create lesson with only English content
   - Request with `?locale=zh`
   - Should return English content (fallback behavior)

## Rollout Strategy

### Phase 1: Infrastructure (Complete ✅)
- Frontend i18n setup
- API locale parameter integration
- Language picker in Settings

### Phase 2: Backend Configuration (Next Step)
- Enable Payload localization
- Configure collections
- Test with sample data

### Phase 3: Content Translation (After Backend Ready)
- Content team adds Chinese translations for existing lessons
- Upload Chinese audio files
- QA testing with real users

### Phase 4: Additional Languages (Future)
- Korean, Spanish, etc.
- Add to `locales` array in both frontend and backend
- Add translations to `lib/i18n.ts`
- Content team adds translations in CMS

## Technical Details

### Frontend i18n Architecture

**Language Detection Priority:**
1. User's saved preference (AsyncStorage)
2. System language (via expo-localization)
3. Fallback to English

**Language Switching:**
- Settings → Language picker
- Changes immediately apply to all screens
- Saved to AsyncStorage for persistence
- API calls automatically use new language

### API Locale Parameter

**How it Works:**
```typescript
// lib/payload.ts
export const fetchPayload = async <T>(
  endpoint: string,
  locale?: string
): Promise<T> => {
  const url = new URL(endpoint, API_BASE_URL);
  
  if (locale) {
    url.searchParams.set('locale', locale); // Appends ?locale=zh
  }
  
  const response = await fetch(url.toString());
  // ...
}
```

**Used By:**
- `fetchLessonsByLevelSlug(levelSlug, locale)` - Home screen
- `fetchLessonById(lessonId, locale)` - Lesson detail screen

## Troubleshooting

### Frontend Issues

**Problem:** UI not translating after language change
- **Solution:** Check that screen component uses `useTranslation()` hook and `t()` function

**Problem:** API calls missing locale parameter
- **Solution:** Verify screen passes `i18n.language` to fetch functions

### Backend Issues (After Implementation)

**Problem:** Always returns English content
- **Solution:** 
  - Check `localization` config in `payload.config.ts`
  - Verify fields have `localized: true`
  - Check that Chinese content exists in admin panel

**Problem:** API returns 404 for locale parameter
- **Solution:** Payload's REST API should automatically handle `?locale=X` - verify Payload version ≥ 2.0

## Resources

- [Payload CMS Localization Docs](https://payloadcms.com/docs/configuration/localization)
- [i18next Documentation](https://www.i18next.com/)
- [React i18next](https://react.i18next.com/)

## Contact

For questions about:
- **Frontend i18n**: Check `frontend/lib/i18n.ts` and component implementations
- **Backend localization**: Follow Payload CMS documentation and this guide
- **Content translation**: Coordinate with content team after backend is ready
