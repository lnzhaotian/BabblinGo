````markdown
# BabblinGo

**BabblinGo** is a mobile language learning platform that delivers immersive, multimedia lessons with offline support. Built with Expo (React Native) and Payload CMS, it provides a modern learning experience with audio, video, and rich content modules.

## 🎯 MVP Features

### **Content & Learning**
- 📚 **Multi-course architecture**: Browse and access multiple language courses
- 🎓 **Flexible module types**: Audio slideshows, video lessons, rich posts, and audio-only content
- 🎵 **Interactive audio player**: Variable playback speed, loop mode, and synchronized slides
- 📝 **Learning session tracking**: Monitor progress with time-based statistics
- 🌐 **Internationalization**: Full i18n support (English, Chinese)

### **User Experience**
- 👤 **User authentication**: Email-based registration and login
- 👥 **User profiles**: Customizable profiles with avatar, bio, and language preferences
- 📊 **Progress tracking**: View learning history and activity charts
- ⚙️ **Account management**: Settings, preferences, security, and account deletion

### **Offline & Sync**
- 💾 **Offline caching**: Download lessons for offline access with smart cache management
- 🔄 **Cloud sync**: Automatic syncing of learning records across devices
- 📡 **Network resilience**: Queue-based sync with retry logic and conflict resolution
- 🎯 **Cache status indicators**: Visual feedback for download progress and cache state

### **Technical Highlights**
- 📱 Native iOS/Android with Expo
- 🎨 Dark mode support
- 🔐 JWT-based authentication with AsyncStorage
- 📈 Analytics instrumentation for user behavior insights
- ✅ Unit tests for core business logic

## Architecture

BabblinGo consists of two main components:

- `BabblinGoAdmin/`: a [Payload CMS](https://payloadcms.com/) instance that provides the admin UI and API
- `frontend/`: an Expo application that consumes the CMS and powers the client experience

## Prerequisites

- Node.js 20.9+ (or use Volta/nvm to match the engines defined by each app)
- Docker Desktop with Docker Compose v2 for running the Payload stack locally
- Expo CLI (`npm install -g expo-cli`) if you plan to run the mobile client on devices or simulators

## Local Development

### Payload CMS (`BabblinGoAdmin`)

1. Copy the sample environment file:
	```bash
	cp BabblinGoAdmin/.env.example BabblinGoAdmin/.env
	```
2. If needed, update `PAYLOAD_SECRET` and any third-party credentials in the new `.env` file.
3. Start Payload and MongoDB via Docker:
	```bash
	cd BabblinGoAdmin
	docker compose up payload
	```
4. Once running, open `http://localhost:3000/admin` to create the first admin user.

### Expo Frontend (`frontend`)

1. Install dependencies:
	```bash
	cd frontend
	npm install
	```
2. Start the Expo development server:
	```bash
	npx expo start
	```
3. Follow the CLI prompts to open the app in a simulator, device, or web browser.

## Contributing

See individual README files in `BabblinGoAdmin/` and `frontend/` for detailed documentation on testing, architecture, and development workflows.## Project Structure

```text
BabblinGo/
├─ BabblinGoAdmin/   # Payload CMS admin + API
├─ frontend/         # Expo application
└─ README.md
```

## Additional Notes

- The legacy NestJS backend has been removed in favor of Payload CMS.
- Commit secrets to `.env` files only through a secure secrets manager—never to Git.
- Run `docker compose down` inside `BabblinGoAdmin` when you are done to stop local containers.
- Integration tests for `BabblinGoAdmin` run outside Docker. Ensure the Mongo container is up (`docker compose up mongo -d`), then execute `pnpm run test:int`. The suite uses `test.env` to override `DATABASE_URI` to `mongodb://127.0.0.1:27017/BabblinGoAdmin`, so keep that file in sync with your local environment.

## Roadmap (high level)

This section captures active product/engineering initiatives so we can pause/resume without losing context. Each area lists current status and next steps.

### 0) Lessons: module type expansion

Goal: Generalize lesson modules so editors can choose between multiple content experiences (e.g., audio slideshow, video, rich post, audio-only) while the app renders each appropriately.

Naming and structure:
- Default legacy content to `type: "audioSlideshow"`; treat missing values as this type during migration.
- Model modules as a discriminated union: shared base fields (id, order, title, summary) plus type-specific payload buckets (e.g., `audioSlideshow.slides[]`, `video.streamUrl`, `richPost.blocks`, `audio.tracks`).
- Persist type-specific content in Payload CMS with dedicated nested objects; keep validation per type.

Backend / CMS tasks:
- Add a `type` enum to the Module schema with options (`audioSlideshow`, `video`, `richPost`, `audio` ...).
- Create type-scoped fields and editor UI fragments so authors only see relevant inputs.
- Write a migration that back-fills `type: "audioSlideshow"` and reshapes existing data into the new structure.
- Expose the new shape via REST (and GraphQL if used) and bump generated typings.

Frontend tasks:
- Update `ModuleDoc` typings under `frontend/lib/payload.ts` with the discriminated union.
- Provide a renderer registry that maps module `type` to a dedicated component (re-using current slideshow/audio experience for `audioSlideshow`).
- Update lesson detail, caching hooks, and session logic to respect module type capabilities (e.g., audio player only when type supplies audio).
- Extend caching inference to gather media per type and adjust navigation for heterogeneous module sequences.

Quality gates:
- Add fixture lessons covering each module type and automated tests for rendering and caching.
- Verify CMS editor validation per type and migration idempotency.
- Roll out backend migration before shipping the frontend change; ensure legacy clients treat missing `type` as `audioSlideshow`.

Status: Planning. Implementation details captured here to avoid losing context while we design the schema and renderer refactor.

### 1) Courses: multi‑course architecture and UX

Goal: Refactor the current Home (BabblinGo) tab into an “All Courses” view that supports multiple courses. Each course can optionally define levels (variable depth). Course detail shows lessons for that course, grouped by level when applicable. Lesson page stays unchanged.

Stack notes: We use Payload CMS for content. This plan introduces a first‑class `courses` collection, relates lessons to courses, and exposes list/detail endpoints via Payload’s REST API.

Scope and milestones:
- Data model (Payload CMS)
	- [x] Create `courses` collection: `slug` (unique), `title` (i18n), `description` (i18n), `coverImage`, `order`, `status` (draft/published), timestamps
	- [x] Optional `levels` array on course: each with `{ key, label (i18n), order }`
	- [x] Update `lessons` collection: add `course` relation (required) and optional `level` (string; must match `levels[].key` if present)
	- [x] Indexes: unique index on `courses.slug`; index on `lessons.course`, `lessons.level`, and `lessons.order` *(2025-11-04 update: `lessons.order` now indexed in schema)*
- API surface (Payload REST)
	- [x] List courses: `GET /api/courses?where[status][equals]=published&locale=xx`
	- [x] Course detail: `GET /api/courses/:id` (includes `levels`)
	- [x] Lessons by course: `GET /api/lessons?where[course][equals]=:id&where[status][equals]=published` with optional `level` filter and `locale`
	- [ ] Back‑compat shim: if older clients request by level slug, resolve to course+level server‑side temporarily (document and deprecate) *(2025‑11‑04 update: currently unnecessary because legacy data/clients were cleared ahead of launch; keep on radar if older builds resurface)*
- Migration / Backfill
	- [x] Legacy content reset on 2025‑11‑04; all seed lessons were recreated directly against the new course schema, so no scripted migration is required
	- [x] Rollback plan limited to re-importing the new seed data snapshot if needed
- Frontend work (Expo app)
	- [x] Refactor Home tab to list courses with cards (cover, title, optional lesson count/progress)
	- [x] Add Course Detail screen (`/course/[courseId]`) that lists lessons; group by level if defined, otherwise flat list
	- [x] Keep the existing lesson screen and cache indicators unchanged
	- [x] Data helpers: `fetchCourses(locale)`, `fetchLessonsByCourse(courseId, { level?, locale })`; deprecate `fetchLessonsByLevelSlug` with a thin wrapper during transition
- Quality gates
	- [x] Backend e2e: courses listing, detail, lessons by course (with and without levels)
	- [x] Frontend tests: courses instrumentation coverage for course/lesson analytics
	- [x] Observability: basic analytics (course_viewed, lesson_opened) wired with buffered event emitter; monitor via debug flag

Rationale and best practices:
- Keep lessons self‑contained; only add `course` relation and optional `level` string for flexibility
- Use Payload’s localization consistently (either fetch locale‑specific fields or handle fallback centrally)
- Prefer cursor/pagination for courses list on mobile; cache with ETag where helpful

Status: Complete — CMS schema and frontend experiences are live; analytics instrumentation, index coverage, and automated tests landed after the 2025‑11‑04 content reset. Back-compat remains optional unless older builds return.

Immediate next steps:
- Continue monitoring analytics output during internal testing (enable `EXPO_PUBLIC_ANALYTICS_DEBUG` as needed) and validate event payloads server-side.
- Keep the back-compat shim note on the backlog in case legacy clients resurface.

See also: the living project tracker with checklists and acceptance criteria in [PROJECT_TRACKER.md](./PROJECT_TRACKER.md).

## User Authentication & Sync Roadmap

This section tracks the step-by-step plan for implementing user authentication and server-side user data sync in BabblinGo. Refer to this roadmap if you need to resume or clarify the next steps during development.

### Progress Update (as of 2025-11-04 — complete)
**Backend:**
- Users collection extended with display name, avatar, bio, location, website, dateOfBirth, and languages
- `auth: true` enabled for password-based authentication
- Email verification, password reset, and forgot password flows working (Aliyun SMTP tested)
- User preferences/settings and activity collections created with access control; verified via `/api/users/*` endpoints

**Frontend:**
- Auth screens wired (login/register/forgot) and JWT stored in AsyncStorage
- Profile page implemented with validation, avatar picker, and new fields (bio, location, website, DOB, native/learning languages)
- Account settings screens cover preferences, security, and delete-account flows; offline and expired-token states show friendly messaging
- Native date picker (iOS/Android) with date-only normalization; persistent across edits

**Sync:**
- Profile, preferences, activity data, and learning records now persist to the backend via authenticated requests with retry/backoff
- Offline sessions queue locally and upload automatically once a connection and valid session token are available

**Testing:**
- Email and auth flows tested (unit + manual multi-device checks)
- Sync regression suite expanded to cover learning record uploads and conflict resolution on reconnect

**Monitoring Notes:**
- Learning sync analytics emit lifecycle events with queue depth, timing, and failure metadata.
- Support runbook for resolving stuck queues lives at `docs/learning-sync-runbook.md`.
- Background cadence is capped at 15 minutes with manual trigger guidance; adjust via `syncLearningRecords` scheduler if usage patterns change.

### 1. Backend: Users Collection & Auth Foundation
- Extend the `Users` collection in Payload CMS:
  - Add fields: display name, avatar, etc. (as needed)
  - Ensure `auth: true` is set for password-based authentication
- Enable email verification, password reset, and forgot password flows
- Test Payload's built-in endpoints:
  - `/api/users/register`, `/api/users/login`, `/api/users/me`, `/api/users/forgot-password`, `/api/users/reset-password`

### 2. Frontend: Auth Integration
- Add screens/components for registration, login, logout, password reset
- Store JWT token securely (AsyncStorage)
- Implement API calls to Payload endpoints for auth
- Add a user context/provider to manage auth state
- Handle email verification and password reset flows in the UI

### 3. Syncing User Data
- Create new collections in Payload for user settings, logs, test results, etc., with a `user` reference field ✅
- Implement authenticated API calls from frontend (send JWT in headers) ✅
- Migrate local data to server after login, if needed ✅
- Update app logic to use server data when logged in, fallback to local otherwise ✅

### 4. Step-by-Step Implementation
1. Backend: Extend Users collection, add user data collections, test endpoints ✅
2. Frontend: Build auth screens, implement JWT storage, add API methods, manage user state ✅
3. Sync: Implement server sync for settings/logs/results and learning records ✅
4. Testing: Test all flows, handle errors, verify multi-device sync ✅ (continue monitoring in beta)

### 5. Optional Enhancements
- Email verification, password reset flows
- Social login (Google, Apple, etc.)
- User profile editing
- Multi-device sync and conflict resolution

**Refer to this roadmap to resume work or clarify next steps if you get stuck.**


