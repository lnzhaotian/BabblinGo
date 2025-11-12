# BabblinGo Frontend

This directory contains the Expo application for BabblinGo. It consumes the APIs exposed by the Payload CMS instance running from `../BabblinGoAdmin`.

## Get started

1. **Configure environment**

   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your API URL:
   ```properties
   NEXT_PUBLIC_API_URL=http://localhost:3000
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the app**

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a development build, an Android emulator, an iOS simulator, or the Expo Go sandbox.

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

> Make sure the Payload CMS (`../BabblinGoAdmin`) is running before testing screens that rely on backend data.

## Environment Variables

The app uses the following environment variables (configured in `.env`):

- `NEXT_PUBLIC_API_URL` (required): URL of the Payload CMS backend
  - Development: `http://localhost:3000`
  - Production: Your production API URL

- `EXPO_PUBLIC_DEBUG` (optional): Enable debug logging
  - Set to `true` to see detailed logs from cache manager, session manager, etc.
  - Default: `false` (only in development builds)

- `EXPO_PUBLIC_ANALYTICS_DEBUG` (optional): Enable analytics event logging
  - Set to `true` to see analytics events in console
  - Default: `false`

**Security Note**: Never commit `.env` files to version control. Use `.env.example` as a template.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Architecture: Lesson Audio and Slides

This app uses a simple, robust pattern for synchronizing lesson slides with audio playback.

Why this design
- Previous multi-track playlist logic struggled with fast swipes and async races. We replaced it with a per-slide, single-track player that remounts on slide changes, which eliminates stale playback and complex cancellation logic.

Key ideas
- Parent controls all state (single source of truth):
   - `loopEnabled` and `playerSpeed` live in the audio slideshow screen: `app/(stack)/lesson/[lessonId]/module/[moduleId].tsx`.
   - The player is a “dumb” view that receives these via props and emits events.
- Remount-per-slide audio:
   - The player is rendered with `key={slideId}` so changing slides destroys the old instance and mounts a new one.
   - The player only loads the track on mount (not on every prop change), avoiding race conditions when swiping quickly.
- Unidirectional data flow:
   - Player emits `onNavigate('prev'|'next')`, `onFinish()`, and `onSpeedChange(speed)`.
   - Parent decides which slide to show and updates state; the player reflects props on next render.
- Programmatic scroll guard:
   - When the parent advances slides (finish or navigation), it sets a ref flag before `scrollToIndex`. The scroll handler clears the flag and does not re-trigger navigation, avoiding feedback loops.
- Silent slides auto-advance:
   - If a slide has no audio, the lesson screen advances after a short dwell (currently ~2.5s).
- Replay-at-end behavior:
   - If the current track finished (e.g., last slide with loop off), pressing play will seek to the start and replay without remounting.

Where to look
- Lesson audio module (parent-controlled state, scroll logic):
   - `frontend/app/(stack)/lesson/[lessonId]/module/[moduleId].tsx`
- Single-track player (one audio per slide):
   - `frontend/components/SingleTrackPlayer.tsx`

## Testing

This project includes a focused unit test setup using Vitest for pure helper logic related to lessons. We intentionally avoid importing React Native or Expo code in unit tests.

- Test runner: Vitest
- Config: `frontend/vitest.config.ts`
- Tests: `frontend/tests/**/*.test.ts`

Run tests

```bash
npm run test
```

Common coverage
- Navigation helpers: prev/next computation, finish behavior, and loop wrapping.
- Slide audio helpers: audio URL resolution and cache substitution.

Troubleshooting: module alias “@”
- If you see errors like `Cannot find module '@/...'` when running tests:
   - Check `vitest.config.ts` has `resolve.alias = { '@': fileURLToPath(new URL('./', import.meta.url)) }`.
   - Ensure `tsconfig.json` has `baseUrl: '.'` and a matching `paths` entry if you use TS path mapping.
   - Delete any stray Jest config that might conflict, then rerun `npm run test`.

Quick QA checklist (manual)
- Start/Stop: Track starts automatically on slide with audio; Play/Pause toggles correctly.
- Rate change: Changing speed while playing continues playback (no pause).
- Slide transitions: Auto-advance on finish; no accidental jumps during playback.
- Loop: With loop on, finishing the last slide wraps to the first; with loop off, it stops at the last.
- Stress: Rapid swipes and toggles don’t break playback.

Extension ideas
- Persist `loopEnabled` and `playerSpeed` to AsyncStorage so preferences survive app restarts.
- If a true playlist view is needed later, build it as a separate component that reuses the single-track player internally.

## Tab Navigation Structure

The app currently uses a combined Home tab that displays both courses and tools in a single view. This was done to avoid empty-looking tabs while content is being built up.

**Current structure (Combined View)**:
- Home tab (`app/(tabs)/index.tsx`): Shows both courses and tools with section headers
- Tools tab (`app/(tabs)/tools.tsx`): Hidden via `href: null` in tab layout
- Progress tab
- Settings tab

**How to restore separate Courses and Tools tabs**:

When you have enough content to justify separate tabs, follow these steps:

1. **Restore the tab layout** (`app/(tabs)/_layout.tsx`):
   - For NativeTabs (iOS 18+): Add back the tools trigger between index and progress
   - For regular Tabs: Remove `href: null` from the tools screen options
   - Optionally change the home icon back to "auto-stories" if desired

2. **Revert the Home tab** (`app/(tabs)/index.tsx`):
   - Remove `fetchTools`, `ToolDoc`, `useMemo` imports
   - Remove `tools` state and `setTools`
   - Remove helper functions: `getIconName`, `FALLBACK_ICON`, `CombinedItem` type, `handlePressTool`, `renderTool`
   - Change `loadCourses` to only fetch courses (remove `Promise.all` and `fetchTools`)
   - Remove `combinedData` useMemo
   - Change FlatList back to use `data={courses}` and `renderItem={renderCourse}`
   - Update keyExtractor to just return `item.id`

3. **Show the Tools tab**:
   - The tools.tsx file already exists and is fully functional
   - It will automatically appear once you remove `href: null` from the layout

**Files to modify**:
- `app/(tabs)/_layout.tsx` - Tab navigation configuration
- `app/(tabs)/index.tsx` - Home screen (currently combined, revert to courses only)
- `app/(tabs)/tools.tsx` - Tools screen (already complete, just hidden)

