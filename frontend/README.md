# BabblinGo Frontend

This directory contains the Expo application for BabblinGo. It consumes the APIs exposed by the Payload CMS instance running from `../BabblinGoAdmin`.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a development build, an Android emulator, an iOS simulator, or the Expo Go sandbox.

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

> Make sure the Payload CMS (`../BabblinGoAdmin`) is running before testing screens that rely on backend data.

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
   - `loopEnabled` and `playerSpeed` live in the lesson screen: `app/(stack)/lesson/[lessonId].tsx`.
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
- Lesson screen (parent-controlled state, scroll logic):
   - `frontend/app/(stack)/lesson/[lessonId].tsx`
- Single-track player (one audio per slide):
   - `frontend/components/SingleTrackPlayer.tsx`

Extension ideas
- Persist `loopEnabled` and `playerSpeed` to AsyncStorage so preferences survive app restarts.
- If a true playlist view is needed later, build it as a separate component that reuses the single-track player internally.
