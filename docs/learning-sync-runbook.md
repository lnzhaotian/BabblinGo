# Learning Sync Runbook

_Last updated: 2025-11-04_

This runbook covers how to monitor, triage, and recover the learning session synchronization loop between the Expo client and Payload backend.

## 1. Quick Reference
- **Primary contact:** Mobile lead on rotation (`#mobile-oncall` Slack).
- **APIs involved:** `POST /api/learning-records/bulk`, `GET /api/learning-records`, `POST /api/learning-records/retry`.
- **Client entry point:** `frontend/lib/learning-sync.ts` (`syncLearningRecords`).
- **Telemetry events:** `learning_sync_started`, `learning_sync_completed`, `learning_sync_failed`, `learning_sync_skipped` (see `frontend/lib/analytics.ts`).
- **Background cadence:** Scheduled every 15 minutes when the app is foregrounded; manual triggers on login, settings save, and lesson completion.

## 2. Monitoring
1. **Analytics dashboard** (`Learning Sync` view in the product analytics workspace):
   - Check success rate (`learning_sync_completed.status === "success"`).
   - Watch queue deltas (`queueDelta`) for sustained positive growth.
   - Track failure stages (`stage` field on `learning_sync_failed`).
2. **Logs:** Cloud functions emit structured logs whenever the bulk sync API returns non-2xx. Filter by `service=learning-sync`.
3. **Alerts:** Pager rules fire if failure rate exceeds 10% over a 15-minute window or if no successful sync events arrive in 30 minutes during active sessions.

## 3. Common Scenarios & Fixes
### 3.1 Unauthorized / Expired Token
- **Signals:** `learning_sync_failed` with `stage=fetch`, `statusCode=401`, repeated `learning_sync_skipped` with `reason="unauthenticated"`.
- **Action:** Ask user to log out/in. If widespread, verify Payload JWT secret alignment and inspect Auth service status.

### 3.2 Payload Outage or 5xx Errors
- **Signals:** `learning_sync_failed` with `stage=push`, `statusCode` >= 500; queue size climbs (positive `queueDelta`).
- **Action:**
  1. Confirm Payload uptime (status page / Pingdom).
  2. If degraded, throttle manual triggers by toggling `syncEnabled` flag in remote config (see section 4).
  3. After recovery, run bulk retry job (see 3.4).

### 3.3 Client Storage Corruption
- **Signals:** Persistent `learning_sync_failed` with `stage="persist"`, error message contains AsyncStorage failures.
- **Action:**
  1. Have user clear app storage (Settings → Advanced → Reset Sync Cache).
  2. Verify new records enqueue and drain successfully.

### 3.4 Stuck Queue After Recovery
- **Signals:** `learning_sync_started` emitted repeatedly with identical `dirtyCount`, no `completed` events.
- **Action:**
  1. Trigger manual retry from support tooling (`POST /api/learning-records/retry` with `userId`).
  2. If queue still stuck, check for malformed payloads in `learning_records` collection; clean up rows and re-run retry.

## 4. Operational Levers
- **Remote config toggle (`learningSync.enabled`):** Disables scheduled sync while preserving manual triggers. Update via config service; clients pick up within 5 minutes.
- **Backoff coefficients:** Controlled in `frontend/lib/learning-sync.ts` (`MAX_RETRY_DELAY_MS`, `BASE_RETRY_DELAY_MS`). Adjust with a patch release if aggressive retry causes load.
- **Telemetry debug flag:** Set `EXPO_PUBLIC_ANALYTICS_DEBUG=true` in staging to stream events to the console.

## 5. Post-Incident Checklist
1. Document incident summary in `Incidents/` confluence space.
2. Capture root cause, duration, and customer impact.
3. File follow-up tickets for code fixes or tooling gaps.
4. Update this runbook if new remediation steps were required.

---

For questions or improvements, reach out in `#mobile-platform`.
