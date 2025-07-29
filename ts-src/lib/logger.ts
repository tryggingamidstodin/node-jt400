export interface Logger {
  debug: (message: any, ...args: any[]) => void
  info: (message: any, ...args: any[]) => void
  warn: (message: any, ...args: any[]) => void
  error: (message: any, ...args: any[]) => void
}

export const createDefaultLogger = (): Logger => {
  // Default logger that does nothing
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }
}
