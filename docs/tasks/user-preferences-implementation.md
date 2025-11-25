# User Preferences & Course Configuration Implementation Plan

## Overview
Implement a "Configuration Hierarchy" for learning records and sync global user settings to the server.
Logic: `Effective State = User_Override ?? Course_Default ?? True`

## Phase 1: Backend (Payload CMS)

- [x] **Update `courses` Collection**
    - [x] Add `defaultTrackingEnabled` field (Boolean, default: `true`).
    - [x] Ensure field is exposed in API responses.
    - [x] Update Admin UI labels/descriptions.

- [x] **Create `user-preferences` Collection**
    - [x] Create new collection `UserPreferences`.
    - [x] Define fields:
        - `user`: Relationship to `users` (required, unique).
        - `global`: Group field.
            - `playbackSpeed`: Number (default: 1.0).
            - `sessionDuration`: Number (default: 900 - 15 mins).
        - `courseOverrides`: Array field.
            - `course`: Relationship to `courses`.
            - `trackingEnabled`: Boolean.
    - [x] Set access control (Users can only read/update their own preferences).
    - [x] Add endpoint/hook to ensure one document per user (or auto-create on first access).

## Phase 2: Frontend (State & Logic)

- [ ] **Preferences Context & Storage**
    - [ ] Create `PreferencesContext` (or Store).
    - [ ] Define types for `UserPreferences`.
    - [ ] Implement `loadPreferences`:
        - Try fetching from API `/api/user-preferences/me`.
        - Fallback to `AsyncStorage` (offline).
        - If no remote or local, use defaults.
    - [ ] Implement `savePreferences`:
        - Optimistic update in Context.
        - Persist to `AsyncStorage`.
        - Sync to API (debounce/queue).

- [ ] **Migration Logic**
    - [ ] On app launch, check for legacy `AsyncStorage` keys (`learning.playbackSpeed`, etc.).
    - [ ] If found and no remote preferences exist, migrate values to new structure and sync.
    - [ ] Clear legacy keys after successful sync.

- [ ] **Session Logic Update**
    - [ ] Update `session-manager.ts` / `saveLearningSession`.
    - [ ] Inject or access `PreferencesContext` (or read from storage).
    - [ ] Implement check: `shouldTrack = userOverride ?? courseDefault ?? true`.
    - [ ] Skip saving if `shouldTrack` is false.

## Phase 3: Frontend (UI)

- [ ] **Settings Screen**
    - [ ] Connect "Default Session Length" and "Playback Speed" to `PreferencesContext`.
    - [ ] Ensure changes trigger the save/sync flow.

- [ ] **Course Detail Screen**
    - [ ] Fetch course details (including `defaultTrackingEnabled`).
    - [ ] Add "Record Learning History" toggle in header or details section.
    - [ ] Toggle state reflects effective state.
    - [ ] Changing toggle updates `courseOverrides` in `PreferencesContext`.
    - [ ] Show "History Paused" indicator if tracking is disabled.

- [ ] **Offline Handling**
    - [ ] Verify settings changes persist when offline.
    - [ ] Verify session logging respects offline settings.

## Phase 4: Testing & Cleanup

- [ ] **Backend Tests**
    - [ ] Verify `defaultTrackingEnabled` defaults to true.
    - [ ] Verify `user-preferences` access control (cannot read others).

- [ ] **Frontend Tests**
    - [ ] Test migration from legacy settings.
    - [ ] Test hierarchy logic (Global vs Course vs User).
    - [ ] Test offline behavior.
