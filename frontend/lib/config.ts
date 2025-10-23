import Constants from 'expo-constants';

// Prefer values injected via Expo app config (Constants.expoConfig.extra) which is
// populated by `app.config.js` at startup. Fall back to process.env for web/dev.
const expoExtra = (Constants.expoConfig && Constants.expoConfig.extra) || {};

export const config = {
  apiUrl:
    expoExtra.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
};