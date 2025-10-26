# BabblinGo Admin (Payload CMS)

This directory hosts the Payload CMS instance that replaces the legacy NestJS backend. It exposes both the admin UI and APIs consumed by the BabblinGo frontend.

## Requirements

- Node.js 20.9+ if you plan to run the app directly
- Docker Desktop with Docker Compose v2 (recommended for local development)

## Environment Setup

1. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
2. Adjust `PAYLOAD_SECRET` and any integration credentials as needed.
3. The default `DATABASE_URI` points to the MongoDB service defined in `docker-compose.yml` (`mongodb://mongo/BabblinGoAdmin`). Update it only if you use an external database.

## Running with Docker (Recommended)

```bash
docker compose up payload
```

The `payload` service depends on the `mongo` service, so the command above starts both containers. When the stack is up, visit `http://localhost:3000/admin` and follow the prompts to create the first admin user.

Stop the services with:

```bash
docker compose down
```

## Running without Docker

1. Ensure you have MongoDB running locally and update `DATABASE_URI` accordingly (for example `mongodb://127.0.0.1/BabblinGoAdmin`).
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`

## Useful Scripts

- `npm run dev` – Start the Next.js dev server
- `npm run build` – Create a production build
- `npm run start` – Run the production build
- `npm run lint` – Lint the project with ESLint
- `npm run test` – Execute unit and end-to-end tests (uses pnpm scripts internally)
- `npm run generate:types` – Regenerate Payload TypeScript definitions

## Project Notes

- The main Payload configuration lives in `src/payload.config.ts`.
- Generated TypeScript types are written to `src/payload-types.ts`.
- Media uploads are stored locally under `media/` during development. Configure external storage before deploying to production.
