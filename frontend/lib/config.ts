import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Prefer values injected via Expo app config (Constants.expoConfig.extra) which is
// populated by `app.config.js` at startup. Fall back to process.env for web/dev.
const expoExtra = (Constants.expoConfig && Constants.expoConfig.extra) || {};

const API_URL_OVERRIDE_KEY = '@app/api_url_override';

const normalizeApiUrl = (raw: string) => raw.trim().replace(/\/$/, '');

const defaultApiUrl = normalizeApiUrl(
  expoExtra.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
);

let runtimeApiUrl = defaultApiUrl;

export async function initializeApiConfig(): Promise<void> {
  try {
    const override = await AsyncStorage.getItem(API_URL_OVERRIDE_KEY);
    if (override && override.trim()) {
      runtimeApiUrl = normalizeApiUrl(override);
    }
  } catch {
    // Non-fatal: keep compile-time default URL.
  }
}

export function getApiUrl(): string {
  return runtimeApiUrl;
}

export async function setApiUrlOverride(url: string): Promise<void> {
  const normalized = normalizeApiUrl(url);
  runtimeApiUrl = normalized;
  await AsyncStorage.setItem(API_URL_OVERRIDE_KEY, normalized);
}

export async function clearApiUrlOverride(): Promise<void> {
  runtimeApiUrl = defaultApiUrl;
  await AsyncStorage.removeItem(API_URL_OVERRIDE_KEY);
}

export function getDefaultApiUrl(): string {
  return defaultApiUrl;
}

export const config = {
  get apiUrl() {
    return runtimeApiUrl;
  },
};