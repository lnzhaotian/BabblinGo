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

