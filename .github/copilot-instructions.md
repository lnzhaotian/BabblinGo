# Copilot Instructions for BabblinGo

## Overview
BabblinGo is a bilingual language learning platform with a **NestJS backend** (`backend/`) and an **Expo/React Native frontend** (`frontend/`). The codebase is split for clear separation of API and client logic.

## Architecture
- **Backend (`backend/`)**: Built with NestJS (TypeScript). Contains modules for authentication, users, and shared decorators. Entry point: `src/main.ts`. App logic is organized by feature folders (e.g., `auth/`, `users/`).
- **Frontend (`frontend/`)**: Built with Expo (React Native, TypeScript). Uses file-based routing in `app/`. Starter code is in `app-example/`; run `npm run reset-project` to reset to a blank state.

## Developer Workflows
### Backend
- **Install dependencies**: `npm install` (in `backend/`)
- **Start server (dev)**: `npm run start:dev`
- **Run tests**: `npm run test` (unit), `npm run test:e2e` (end-to-end)
- **Build for production**: `npm run start:prod`
- **Config files**: `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `eslint.config.mjs`

### Frontend
- **Install dependencies**: `npm install` (in `frontend/`)
- **Start app**: `npx expo start` or `npm run web` for web preview
- **Reset project**: `npm run reset-project` (moves starter code to `app-example/`)
- **Config files**: `tsconfig.json`, `eslint.config.js`, `app.json`, `expo-env.d.ts`

## Patterns & Conventions
- **Backend**: Follows NestJS module/controller/service pattern. Feature folders for scalability. Shared decorators in `common/decorators/`.
- **Frontend**: File-based routing in `app/`. Components and hooks are organized by domain. Themed UI components in `components/ui/`.
- **Testing**: Backend tests in `test/` (e2e) and `src/` (unit/spec). Frontend does not include test setup by default.
- **Resetting Frontend**: Use `npm run reset-project` to clear the starter and begin fresh development.

## Integration Points
- **API Communication**: Frontend communicates with backend via REST endpoints (see backend controllers).
- **External Dependencies**: Backend uses NestJS and related packages. Frontend uses Expo, React Native, and community libraries.

## Key Files & Directories
- `backend/src/main.ts`: Backend entry point
- `backend/src/app.module.ts`: Main NestJS module
- `frontend/app/`: Main app code (file-based routing)
- `frontend/app-example/`: Starter code and UI examples
- `frontend/components/`: Shared React Native components
- `frontend/hooks/`: Custom hooks for theming and color schemes

## Example Commands
- Backend: `npm run start:dev` (dev server), `npm run test:e2e` (e2e tests)
- Frontend: `npx expo start` (dev), `npm run reset-project` (reset)

## Tips for AI Agents
- Respect the separation between backend and frontend logic.
- Use feature folders for new backend modules/services.
- For new frontend screens, add files to `app/` and update routing as needed.
- Reference existing components/hooks for theming and UI consistency.
- Always check for project-specific scripts (e.g., `reset-project`) before making structural changes.

---
_Last updated: 2025-10-23_
