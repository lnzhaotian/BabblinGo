// Load .env values at Expo config time so they are available via Constants.expoConfig.extra
// This runs when Expo starts (metro bundler) and in builds.
// Load dotenv if present - it's already in package-lock, but keep it optional.
try {
  const path = require('path');
  require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });
} catch {
  // ignore if dotenv isn't installed or fails
}

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    'expo-localization',
    'expo-audio',
    'expo-video',
  ],
  extra: {
    ...(config.extra || {}),
    // Mirror the NEXT_PUBLIC_API_URL from .env into expo's extra config
    // Falls back to production URL if not set
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://admin.babblinguide.cn',
  },
});
