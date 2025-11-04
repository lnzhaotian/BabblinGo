// Any setup scripts you might need go here

// Load .env files with test overrides. Vitest runs outside Docker, so we
// explicitly layer `test.env` after the default .env to adjust connection
// strings (e.g., pointing MongoDB at localhost instead of the container
// hostname).
import { config as loadEnv } from 'dotenv'

loadEnv()
loadEnv({ path: 'test.env', override: true })
