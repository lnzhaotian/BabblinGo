# Backend Localization Testing Guide

## Setup Complete ✅

The Payload CMS backend has been configured with localization support:

### Configuration Changes Made:

1. **payload.config.ts** - Added localization config:
   ```typescript
   localization: {
     locales: ['en', 'zh'],
     defaultLocale: 'en',
     fallback: true,
   }
   ```

2. **Lessons Collection** - Localized fields:
   - `title` - Lesson title
   - `summary` - Lesson description

3. **Modules Collection** - Localized fields:
   - `title` - Module title
   - `body` - Module rich text content
   - `audio` - Audio files (different audio for each language)
   - `image` - Images (different images for each language)

4. **Levels Collection** - Localized fields:
   - `title` - Level name (e.g., "Novice" / "初级")
   - `summary` - Level description

## Testing Instructions

### Part 1: Admin Panel Verification

The admin panel is now running at: **http://localhost:3001**

#### 1. Check Language Tabs Appear

1. **Login** to the admin panel
2. Navigate to **Collections → Lessons**
3. **Open or create** a lesson
4. You should see **language tabs** at the top of the form:
   ```
   [ English ] [ 中文 ]
   ```

#### 2. Add Chinese Content

**Test with a Lesson:**

1. Open an existing lesson (or create new)
2. In **English** tab:
   - Title: "Greetings"
   - Summary: "Learn basic greetings in Chinese"
3. Switch to **中文** tab:
   - Title: "问候语"
   - Summary: "学习基本的中文问候语"
4. **Save** the lesson

**Test with a Module:**

1. Navigate to **Collections → Modules**
2. Open a module linked to the lesson above
3. In **English** tab:
   - Title: "Hello"
   - Body: "The word for hello is 你好 (nǐ hǎo)"
4. Switch to **中文** tab:
   - Title: "你好"
   - Body: "最常用的打招呼方式"
5. For **Audio** field:
   - English tab: Upload English audio file
   - 中文 tab: Upload Chinese audio file
6. **Save** the module

### Part 2: API Testing

#### Test 1: Default Locale (English)

```bash
# Fetch lessons without locale parameter (should return English)
curl http://localhost:3001/api/lessons

# Expected: title: "Greetings", summary: "Learn basic greetings..."
```

#### Test 2: Explicit English Locale

```bash
# Fetch lessons with English locale
curl http://localhost:3001/api/lessons?locale=en

# Expected: Same as default - English content
```

#### Test 3: Chinese Locale

```bash
# Fetch lessons with Chinese locale
curl "http://localhost:3001/api/lessons?locale=zh"

# Expected: title: "问候语", summary: "学习基本的中文问候语"
```

#### Test 4: Specific Lesson by ID

```bash
# Get a specific lesson in Chinese
curl "http://localhost:3001/api/lessons/<lesson-id>?locale=zh"

# Expected: Chinese title, summary, and populated modules with Chinese content
```

#### Test 5: Fallback Behavior

1. Create a lesson with **only English** content (don't fill in 中文 tab)
2. Request with `?locale=zh`
3. **Expected**: Should return English content (fallback)

```bash
curl "http://localhost:3001/api/lessons/<new-lesson-id>?locale=zh"

# Should return English content since Chinese doesn't exist
```

### Part 3: Frontend Integration Testing

#### Test Mobile App with Backend

1. **Start frontend:**
   ```bash
   cd frontend
   npm run start -c
   ```

2. **Change language in app:**
   - Open app → Settings → Language → Select "中文"

3. **Navigate to Home screen:**
   - Should see "第 01 课" instead of "Lesson 01"
   - Should see Chinese lesson titles and summaries

4. **Open a lesson:**
   - Should load Chinese modules
   - Should play Chinese audio

5. **Check Network tab:**
   - API calls should include `?locale=zh`
   - Example: `GET /api/lessons?level=novice&locale=zh`

#### Verify API Response

**English Response:**
```json
{
  "docs": [
    {
      "id": "...",
      "title": "Greetings",
      "summary": "Learn basic greetings in Chinese",
      "modules": [
        {
          "title": "Hello",
          "body": { ... },
          "audio": "english-audio.mp3"
        }
      ]
    }
  ]
}
```

**Chinese Response (`?locale=zh`):**
```json
{
  "docs": [
    {
      "id": "...",
      "title": "问候语",
      "summary": "学习基本的中文问候语",
      "modules": [
        {
          "title": "你好",
          "body": { ... },
          "audio": "chinese-audio.mp3"
        }
      ]
    }
  ]
}
```

### Part 4: Content Editor Workflow

#### Creating Bilingual Content

**Step-by-step workflow for content team:**

1. **Create lesson in English first:**
   - Collections → Lessons → Create New
   - Fill in English title, summary
   - Assign to a Level
   - Save

2. **Add Chinese translation:**
   - Open the saved lesson
   - Click **中文** tab
   - Fill in Chinese title, summary
   - Save again

3. **Create modules for the lesson:**
   - Collections → Modules → Create New
   - Select the lesson
   - **English tab:**
     - Title, body, upload English audio
   - **中文 tab:**
     - Title, body, upload Chinese audio
   - Save

4. **Verify in frontend:**
   - Change app language to test both versions
   - Check that correct audio plays for each language

### Part 5: Troubleshooting

#### Problem: No language tabs in admin panel

**Solution:**
- Verify `localization` config exists in `payload.config.ts`
- Restart the dev server: `pnpm dev`
- Clear browser cache

#### Problem: API always returns English

**Solutions:**
1. Check URL includes `?locale=zh` parameter
2. Verify Chinese content exists in admin panel
3. Check fallback is working (English returned if Chinese missing)

#### Problem: Frontend not passing locale parameter

**Solutions:**
1. Check `i18n.language` is correct: `console.log(i18n.language)`
2. Verify API calls in Network tab include locale
3. Check `lib/payload.ts` - `fetchPayload` should append locale

#### Problem: Audio not switching languages

**Solutions:**
1. Verify separate audio files uploaded for English and 中文 tabs
2. Check module response includes correct audio URL for locale
3. Verify Media collection allows multiple uploads per module

## Success Criteria

✅ **Backend Ready** when:
- [ ] Language tabs (English/中文) appear in admin panel
- [ ] Can save different content for each language
- [ ] API returns English by default
- [ ] API returns Chinese with `?locale=zh`
- [ ] Fallback to English works when Chinese missing

✅ **End-to-end Working** when:
- [ ] App UI switches to Chinese in Settings
- [ ] Home screen shows Chinese lesson titles
- [ ] Lesson detail loads Chinese modules
- [ ] Chinese audio plays when language is 中文
- [ ] Switching back to English works correctly

## Next Steps

### Phase 1: Backend Testing (Current)
- Test admin panel language tabs
- Create sample bilingual content
- Verify API responses with curl

### Phase 2: Content Creation
- Content team creates Chinese translations for all lessons
- Upload Chinese audio files
- QA test all lessons in both languages

### Phase 3: Production Deployment
- Deploy backend with localization to production
- Update frontend to point to production API
- Announce multi-language support to users

### Phase 4: Additional Languages (Future)
To add more languages (Korean, Spanish, etc.):

1. **Update backend:**
   ```typescript
   // payload.config.ts
   localization: {
     locales: ['en', 'zh', 'ko', 'es'],
     defaultLocale: 'en',
     fallback: true,
   }
   ```

2. **Update frontend:**
   ```typescript
   // lib/i18n.ts
   const resources = {
     en: { translation: { ... } },
     zh: { translation: { ... } },
     ko: { translation: { ... } },
     es: { translation: { ... } },
   }
   ```

3. **Regenerate types:**
   ```bash
   pnpm generate:types
   ```

4. **Content team adds translations in admin panel**

## Resources

- **Admin Panel**: http://localhost:3001
- **API Base**: http://localhost:3001/api
- **Payload Docs**: https://payloadcms.com/docs/configuration/localization
- **Frontend i18n Guide**: See `/LOCALIZATION.md`

## Support

For issues:
1. Check this guide's troubleshooting section
2. Verify configuration files match examples
3. Check server logs: `tail -f .next/trace` (if enabled)
4. Review Payload CMS docs for version 3.x localization
