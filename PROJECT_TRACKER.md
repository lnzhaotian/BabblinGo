# Project Tracker

Last updated: 2025-11-04

This tracker captures epics, milestones, and acceptance criteria so we can pause/resume confidently. Use this as the single source of truth during the Courses refactor and while wrapping up Users/Auth.

---

## Epic A: Courses — Multi-course Architecture and UX

Goal: Refactor Home into an “All Courses” view. Support many courses; each course may or may not have levels. Course Detail lists lessons (grouped by level if present). Lesson screen remains unchanged.

### Scope
- Backend (Payload CMS)
  - Create `courses` collection: slug (unique), title (i18n), description (i18n), coverImage, order, status, timestamps *(shipped)*
  - Optional `levels` array: [{ key, label (i18n), order }] *(shipped)*
  - Update `lessons` collection: add `course` relation (required), optional `level` key *(shipped)*
  - Indexes: unique on `courses.slug`; indexes on `lessons.course`, `lessons.level`, `lessons.order` *(course slug + course/level indexes landed; `lessons.order` index still pending)*
- API (Payload REST)
  - List courses: GET /api/courses?where[status][equals]=published&locale=xx
  - Course detail: GET /api/courses/:id
  - Lessons by course: GET /api/lessons?where[course][equals]=:id&where[status][equals]=published&where[level][equals]=:key (optional)&locale=xx
  - Back-compat shim: Resolve legacy level-slug calls to course+level; document and deprecate *(2025-11-04 update: not required because legacy clients/data were cleared; revisit if older builds return)*
- Frontend (Expo)
  - Home tab shows courses list (cards)
  - New Course Detail screen `/course/[courseId]` lists lessons (grouped if levels exist)
  - Reuse lesson row UI and cache indicators; keep lesson screen intact
  - Data helpers: fetchCourses(locale), fetchLessonsByCourse(courseId, { level?, locale })

### Milestones
- A1 Data model & Migration
  - [x] Create `courses` collection in Payload
  - [x] Backfill reset: removed legacy seed data on 2025-11-04 and recreated lessons against the new course schema (no migration script required)
  - [ ] Add remaining index on `lessons.order`; other constraints are in place
  - [x] Rollback approach: re-import the post-reset seed snapshot if recovery is needed
- A2 API and Back-compat
  - [x] Expose list/detail endpoints for courses
  - [x] Expose lessons-by-course; support optional `level` filter
  - [ ] Implement level-slug shim only if legacy builds reappear (currently unnecessary)
- A3 Frontend Refactor
  - [x] Replace Home with courses list (loading/empty/error states)
  - [x] Implement Course Detail screen; group lessons by level if present
  - [x] Wire data helpers; keep cache indicators
  - [ ] Instrument analytics: course_viewed, lesson_opened
- A4 Testing & Rollout
  - [ ] Backend e2e: courses list/detail, lessons-by-course (with and without levels)
  - [ ] Frontend tests: navigation flows (Home → Course → Lesson)
  - [ ] Rollout plan: flag/toggle for Home refactor, monitoring, rollback

### Acceptance Criteria
- Home lists all courses (i18n title, cover) with pagination if needed
- Tapping a course shows lessons; grouping by level when defined
- Existing lesson screen works unchanged
- API enables adding future courses with differing level depth without code changes
- Back-compat layer exists during transition and is removed after validation

### Risks / Mitigations
- Course ordering performance → ship the pending `lessons.order` index before content volume increases
- i18n completeness → define fallbacks and QA pass
- Performance on large lists → pagination + cache headers

---

## Epic B: Users & Auth — Profile and Sync

Goal: Complete user-facing auth flows and profile management, then add server sync for user settings/logs/results.

### Current Status (2025-11-04)
- Backend
  - Users collection includes displayName, avatarIcon, bio, location, website, dateOfBirth, native/learning languages
  - Auth flows working (register/login/me/forgot/reset), email via Aliyun SMTP
  - User preference, activity, and learning record collections live with access control hooks
- Frontend
  - Auth screens wired; JWT storage in AsyncStorage
  - Profile and account settings polished (validations, avatar picker, security & delete flows)
  - Offline/expired-token UX handled with graceful messaging across screens
  - Learning sessions sync online/offline automatically with retry/backoff
- Sync
  - Profile, settings, activity, and learning records persist via authenticated API
  - Local queue drains automatically when connectivity/auth is restored

### Remaining Work
- B5 Monitoring & Support
  - [ ] Add analytics/telemetry for sync success/failure and queue depth
  - [ ] Document operational runbooks for resolving stuck or conflicting learning records
  - [ ] Evaluate background sync cadence vs. battery/runtime impact during beta

### Completed Since Previous Update
- B1 Backend Collections
  - [x] User settings collection (user ref, preferences)
  - [x] Logs/results collections (user ref, data shapes)
  - [x] Access control and validation
- B2 Frontend Features
  - [x] Account settings (security, delete account UI)
  - [x] Error states and recovery (offline/expired token)
- B3 Sync Implementation
  - [x] Authenticated fetch helpers; retry/backoff
  - [x] Learning records migrate from local storage with conflict detection
- B4 Testing
  - [x] Baseline auth + sync regression suite (profile, settings, learning records); expand for edge analytics once instrumentation lands

### Acceptance Criteria
- Users can manage profile and settings; changes persist across devices
- Auth flows robust with clear error states
- Data sync is reliable with sensible conflict handling

---

## Cross-cutting
- i18n: ensure keys for new UI (courses list/cards, course detail headers, empty/loading states)
- Accessibility: announce course titles and counts; maintain focus order
- Analytics: add minimal event set for validation; avoid PII
- Security: never commit secrets; follow Payload access control for user data

---

## Execution Notes
- Prioritization: Epic A (Courses) first, then resume Epic B (User/Auth) remaining items
- Branching: feature branches per milestone (e.g., feature/courses-a1)
- Review: short PRs with screenshots/screencasts for UI
- Rollback: keep shims until post-release validation is done
