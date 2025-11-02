# Project Tracker

Last updated: 2025-11-02

This tracker captures epics, milestones, and acceptance criteria so we can pause/resume confidently. Use this as the single source of truth during the Courses refactor and while wrapping up Users/Auth.

---

## Epic A: Courses — Multi-course Architecture and UX

Goal: Refactor Home into an “All Courses” view. Support many courses; each course may or may not have levels. Course Detail lists lessons (grouped by level if present). Lesson screen remains unchanged.

### Scope
- Backend (Payload CMS)
  - Create `courses` collection: slug (unique), title (i18n), description (i18n), coverImage, order, status, timestamps
  - Optional `levels` array: [{ key, label (i18n), order }]
  - Update `lessons` collection: add `course` relation (required), optional `level` key
  - Indexes: unique on `courses.slug`; indexes on `lessons.course`, `lessons.level`, `lessons.order`
- API (Payload REST)
  - List courses: GET /api/courses?where[status][equals]=published&locale=xx
  - Course detail: GET /api/courses/:id
  - Lessons by course: GET /api/lessons?where[course][equals]=:id&where[status][equals]=published&where[level][equals]=:key (optional)&locale=xx
  - Back-compat shim: Resolve legacy level-slug calls to course+level; document and deprecate
- Frontend (Expo)
  - Home tab shows courses list (cards)
  - New Course Detail screen `/course/[courseId]` lists lessons (grouped if levels exist)
  - Reuse lesson row UI and cache indicators; keep lesson screen intact
  - Data helpers: fetchCourses(locale), fetchLessonsByCourse(courseId, { level?, locale })

### Milestones
- A1 Data model & Migration
  - [ ] Create `courses` collection in Payload
  - [ ] Backfill: create default “BabblinGo” course and attach existing lessons
  - [ ] Add indexes and constraints
  - [ ] Write idempotent migration + rollback plan
- A2 API and Back-compat
  - [ ] Expose list/detail endpoints for courses
  - [ ] Expose lessons-by-course; support optional `level` filter
  - [ ] Implement level-slug shim; mark deprecated
- A3 Frontend Refactor
  - [ ] Replace Home with courses list (loading/empty/error states)
  - [ ] Implement Course Detail screen; group lessons by level if present
  - [ ] Wire data helpers; keep cache indicators
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
- Data backfill integrity → idempotent migration, pre-prod dry run
- i18n completeness → define fallbacks and QA pass
- Performance on large lists → pagination + cache headers

---

## Epic B: Users & Auth — Profile and Sync

Goal: Complete user-facing auth flows and profile management, then add server sync for user settings/logs/results.

### Current Status (2025-11-02)
- Backend
  - Users collection includes displayName, avatarIcon, bio, location, website, dateOfBirth, native/learning languages
  - Auth flows working (register/login/me/forgot/reset), email via Aliyun SMTP
- Frontend
  - Auth screens wired; JWT storage in AsyncStorage
  - Profile page polished (validations, avatar picker, native date picker with date-only normalization)
  - Header Save/Cancel actions update correctly; safe-area+layout fixed
- Sync
  - Profile edits persist via authenticated API
  - Next: add collections for settings/logs/results and wire sync

### Remaining Work
- B1 Backend Collections
  - [ ] User settings collection (user ref, preferences)
  - [ ] Logs/results collections (user ref, data shapes)
  - [ ] Access control and validation
- B2 Frontend Features
  - [ ] Account settings (security, delete account UI)
  - [ ] Error states and recovery (offline/expired token)
- B3 Sync Implementation
  - [ ] Authenticated fetch helpers; retry/backoff
  - [ ] Migrate local data to server on login; conflict policy
- B4 Testing
  - [ ] E2E auth coverage; multi-device session tests

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
