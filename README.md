# BabblinGo

BabblinGo is now composed of two apps:

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
4. Once the containers are running, open `http://localhost:3000/admin` to create the first admin user.

> The compose setup exposes MongoDB internally at `mongodb://mongo/BabblinGoAdmin`. Change `DATABASE_URI` only if you point to an external database.

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

## Project Structure

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

## Roadmap (high level)

This section captures active product/engineering initiatives so we can pause/resume without losing context. Each area lists current status and next steps.

### 1) Courses: multi‑course architecture and UX

Goal: Refactor the current Home (BabblinGo) tab into an “All Courses” view that supports multiple courses. Each course can optionally define levels (variable depth). Course detail shows lessons for that course, grouped by level when applicable. Lesson page stays unchanged.

Stack notes: We use Payload CMS for content. This plan introduces a first‑class `courses` collection, relates lessons to courses, and exposes list/detail endpoints via Payload’s REST API.

Scope and milestones:
- Data model (Payload CMS)
	- [x] Create `courses` collection: `slug` (unique), `title` (i18n), `description` (i18n), `coverImage`, `order`, `status` (draft/published), timestamps
	- [x] Optional `levels` array on course: each with `{ key, label (i18n), order }`
	- [x] Update `lessons` collection: add `course` relation (required) and optional `level` (string; must match `levels[].key` if present)
	- [ ] Indexes: unique index on `courses.slug`; index on `lessons.course`, `lessons.level`, and `lessons.order` *(course slug + course/level indexes landed; ordering index still pending)*
- API surface (Payload REST)
	- [x] List courses: `GET /api/courses?where[status][equals]=published&locale=xx`
	- [x] Course detail: `GET /api/courses/:id` (includes `levels`)
	- [x] Lessons by course: `GET /api/lessons?where[course][equals]=:id&where[status][equals]=published` with optional `level` filter and `locale`
	- [ ] Back‑compat shim: if older clients request by level slug, resolve to course+level server‑side temporarily (document and deprecate)
- Migration
	- [ ] Create a default “BabblinGo” course; backfill existing lessons with this `course` relation and appropriate `level`
	- [ ] Idempotent script and rollback plan; apply indexes after backfill
- Frontend work (Expo app)
	- [x] Refactor Home tab to list courses with cards (cover, title, optional lesson count/progress)
	- [x] Add Course Detail screen (`/course/[courseId]`) that lists lessons; group by level if defined, otherwise flat list
	- [x] Keep the existing lesson screen and cache indicators unchanged
	- [x] Data helpers: `fetchCourses(locale)`, `fetchLessonsByCourse(courseId, { level?, locale })`; deprecate `fetchLessonsByLevelSlug` with a thin wrapper during transition
- Quality gates
	- [ ] Backend e2e: courses listing, detail, lessons by course (with and without levels)
	- [ ] Frontend tests: courses list rendering, navigation flows (Home → Course → Lesson), empty/loading/error states
	- [ ] Observability: basic analytics (course_viewed, lesson_opened), monitoring, rollback plan

Rationale and best practices:
- Keep lessons self‑contained; only add `course` relation and optional `level` string for flexibility
- Use Payload’s localization consistently (either fetch locale‑specific fields or handle fallback centrally)
- Prefer cursor/pagination for courses list on mobile; cache with ETag where helpful

Status: In progress — CMS schema and frontend experiences are live; remaining work covers migrations/back‑compat, additional indexes, and end-to-end testing.

Immediate next steps:
- Ship the migration/backfill script for existing lessons and apply the outstanding indexes (notably `lessons.order`).
- Implement the temporary level-slug back-compat shim and document the deprecation path.
- Add automated coverage (backend e2e + frontend navigation tests) and wire up analytics/monitoring for the new flows.

See also: the living project tracker with checklists and acceptance criteria in [PROJECT_TRACKER.md](./PROJECT_TRACKER.md).

## User Authentication & Sync Roadmap

This section tracks the step-by-step plan for implementing user authentication and server-side user data sync in BabblinGo. Refer to this roadmap if you need to resume or clarify the next steps during development.

### Progress Update (as of 2025-11-02)
**Backend:**
- Users collection extended with display name, avatar, bio, location, website, dateOfBirth, and languages
- `auth: true` enabled for password-based authentication
- Email verification, password reset, and forgot password flows working (Aliyun SMTP tested)
- Payload endpoints verified: `/api/users/register`, `/api/users/login`, `/api/users/me`, `/api/users/forgot-password`, `/api/users/reset-password`

**Frontend:**
- Auth screens wired (login/register/forgot) and JWT stored in AsyncStorage
- Profile page implemented with validation, avatar picker, and new fields (bio, location, website, DOB, native/learning languages)
- Native date picker (iOS/Android) with date‑only normalization; persistent across edits
- Header actions for Save/Cancel during edit; safe‑area and layout polish across tabs

**Sync:**
- Profile field edits persist to backend via authenticated requests
- Next: Add collections for user settings/logs/results with `user` reference and wire sync flows

**Testing:**
- Email flows tested and working
- Next: Broaden E2E auth coverage; test multi‑device scenarios and error handling

**Next Steps:**
1. Backend: Add user data collections (settings, logs, results) with access control
2. Frontend: Expand account settings (security, delete account), improve error states
3. Sync: Implement server sync for settings/logs/results; add migration path from local data
4. Testing: E2E auth + sync tests, multi‑device verification

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
- Create new collections in Payload for user settings, logs, test results, etc., with a `user` reference field
- Implement authenticated API calls from frontend (send JWT in headers)
- Migrate local data to server after login, if needed
- Update app logic to use server data when logged in, fallback to local otherwise

### 4. Step-by-Step Implementation
1. Backend: Extend Users collection, add user data collections, test endpoints
2. Frontend: Build auth screens, implement JWT storage, add API methods, manage user state
3. Sync: Implement server sync for settings/logs/results, migrate local data
4. Testing: Test all flows, handle errors, verify multi-device sync

### 5. Optional Enhancements
- Email verification, password reset flows
- Social login (Google, Apple, etc.)
- User profile editing
- Multi-device sync and conflict resolution

**Refer to this roadmap to resume work or clarify next steps if you get stuck.**


