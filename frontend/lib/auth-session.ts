import AsyncStorage from '@react-native-async-storage/async-storage'

type AuthStateListener = (state: { isAuthenticated: boolean }) => void

type ProfileCache = {
  email: string | null
  displayName: string | null
  avatarIcon: string | null
  tokenBalance: number | null
}

const AUTH_TOKEN_KEY = 'jwt'
const PROFILE_EMAIL_KEY = 'user_email'
const PROFILE_DISPLAY_NAME_KEY = 'user_displayName'
const PROFILE_AVATAR_KEY = 'user_avatarIcon'
const PROFILE_TOKEN_BALANCE_KEY = 'user_tokenBalance'

const listeners = new Set<AuthStateListener>()

const notify = (isAuthenticated: boolean) => {
  const snapshot = Array.from(listeners)
  for (const listener of snapshot) {
    try {
      listener({ isAuthenticated })
    } catch (error) {
      console.warn('[auth-session] listener error', error)
    }
  }
}

const normalize = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const subscribeAuthState = (listener: AuthStateListener): (() => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const getAuthToken = async (): Promise<string | null> => {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY)
}

export const getCachedProfile = async (): Promise<ProfileCache> => {
  const entries = await AsyncStorage.multiGet([
    PROFILE_EMAIL_KEY,
    PROFILE_DISPLAY_NAME_KEY,
    PROFILE_AVATAR_KEY,
    PROFILE_TOKEN_BALANCE_KEY,
  ])
  const map = new Map(entries)

  const tokenBalanceStr = map.get(PROFILE_TOKEN_BALANCE_KEY)
  const tokenBalance = tokenBalanceStr ? parseInt(tokenBalanceStr, 10) : null

  return {
    email: normalize(map.get(PROFILE_EMAIL_KEY) ?? null),
    displayName: normalize(map.get(PROFILE_DISPLAY_NAME_KEY) ?? null),
    avatarIcon: normalize(map.get(PROFILE_AVATAR_KEY) ?? null),
    tokenBalance: isNaN(tokenBalance as number) ? null : tokenBalance,
  }
}

export const updateProfileCache = async (profile: Partial<ProfileCache>): Promise<void> => {
  const sets: [string, string][] = []
  const removes: string[] = []

  if ('email' in profile) {
    const next = normalize(profile.email ?? null)
    if (next) {
      sets.push([PROFILE_EMAIL_KEY, next])
    } else {
      removes.push(PROFILE_EMAIL_KEY)
    }
  }

  if ('displayName' in profile) {
    const next = normalize(profile.displayName ?? null)
    if (next) {
      sets.push([PROFILE_DISPLAY_NAME_KEY, next])
    } else {
      removes.push(PROFILE_DISPLAY_NAME_KEY)
    }
  }

  if ('avatarIcon' in profile) {
    const next = normalize(profile.avatarIcon ?? null)
    if (next) {
      sets.push([PROFILE_AVATAR_KEY, next])
    } else {
      removes.push(PROFILE_AVATAR_KEY)
    }
  }

  if ('tokenBalance' in profile) {
    const next = profile.tokenBalance
    if (next !== null && next !== undefined) {
      sets.push([PROFILE_TOKEN_BALANCE_KEY, next.toString()])
    } else {
      removes.push(PROFILE_TOKEN_BALANCE_KEY)
    }
  }

  if (sets.length > 0) {
    await AsyncStorage.multiSet(sets)
  }
  if (removes.length > 0) {
    await AsyncStorage.multiRemove(removes)
  }
}

export const setAuthSession = async (
  token: string,
  profile?: Partial<ProfileCache>
): Promise<void> => {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token)
  if (profile && Object.keys(profile).length > 0) {
    await updateProfileCache(profile)
  }
  notify(true)
}

export const clearAuthSession = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    AUTH_TOKEN_KEY,
    PROFILE_EMAIL_KEY,
    PROFILE_DISPLAY_NAME_KEY,
    PROFILE_AVATAR_KEY,
    PROFILE_TOKEN_BALANCE_KEY,
  ])
  notify(false)
}

export type { ProfileCache }
