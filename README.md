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

See individual README files in `BabblinGoAdmin/` and `frontend/` for detailed documentation on testing, architecture, and development workflows.

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
- Integration tests for `BabblinGoAdmin` run outside Docker. Ensure the Mongo container is up (`docker compose up mongo -d`), then execute `pnpm run test:int`. The suite uses `test.env` to override `DATABASE_URI` to `mongodb://127.0.0.1:27017/BabblinGoAdmin`, so keep that file in sync with your local environment.

## Roadmap

For a living roadmap with epics, milestones, and acceptance criteria, see `PROJECT_TRACKER.md`.


