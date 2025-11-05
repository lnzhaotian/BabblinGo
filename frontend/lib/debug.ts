/**
 * Debug logging utility
 * 
 * Use these instead of console.log to allow disabling debug logs in production.
 * Set EXPO_PUBLIC_DEBUG=true in .env to enable debug logging.
 */

const isDebugEnabled = process.env.EXPO_PUBLIC_DEBUG === 'true' || __DEV__

export const debug = {
  log: (...args: any[]) => {
    if (isDebugEnabled) {
      console.log(...args)
    }
  },
  warn: (...args: any[]) => {
    console.warn(...args)
  },
  error: (...args: any[]) => {
    console.error(...args)
  },
}

/**
 * Create a scoped logger with a prefix
 * Example: const log = createLogger('[cache-manager]')
 */
export function createLogger(prefix: string) {
  return {
    log: (...args: any[]) => debug.log(prefix, ...args),
    warn: (...args: any[]) => debug.warn(prefix, ...args),
    error: (...args: any[]) => debug.error(prefix, ...args),
  }
}
