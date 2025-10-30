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

## User Authentication & Sync Roadmap

This section tracks the step-by-step plan for implementing user authentication and server-side user data sync in BabblinGo. Refer to this roadmap if you need to resume or clarify the next steps during development.

### Progress Update (as of 2025-10-30)
**Backend:**
- Users collection extended with display name, avatar, bio, and role fields
- `auth: true` enabled for password-based authentication
- Email verification, password reset, and forgot password flows are working (Aliyun SMTP tested)
- Payload endpoints tested: `/api/users/register`, `/api/users/login`, `/api/users/me`, `/api/users/forgot-password`, `/api/users/reset-password`

**Frontend:**
- Ready for auth integration (screens/components for registration, login, logout, password reset to be built)
- JWT storage and user context/provider planned
- API calls to Payload endpoints to be implemented

**Sync:**
- Next: Create collections for user settings, logs, test results, etc. (with user reference)
- Next: Implement authenticated API calls and server sync logic

**Testing:**
- Email flows tested and working
- Next: Test full auth and sync flows, multi-device scenarios

**Next Steps:**
1. Backend: Add user data collections (settings, logs, results)
2. Frontend: Build auth screens, implement JWT storage, add API methods, manage user state
3. Sync: Implement server sync for settings/logs/results, migrate local data
4. Testing: Test all flows, handle errors, verify multi-device sync

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

