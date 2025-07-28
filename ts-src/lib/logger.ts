export type Logger = {
  debug: (message: any, ...args: any[]) => void
  info: (message: any, ...args: any[]) => void
  warn: (message: any, ...args: any[]) => void
  error: (message: any, ...args: any[]) => void
}

export const createDefaultLogger = (): Logger => {
  return {
    debug: () => {}, // No-op for debug by default
    info: () => {}, // No-op for debug by default
    warn: () => {}, // No-op for debug by default
    error: () => {}, // No-op for debug by default
  }
}
