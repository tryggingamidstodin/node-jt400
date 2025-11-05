import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'

/**
 * Find the package root directory by looking for java/lib/jt400.jar
 * This works whether the module is used directly or as a dependency
 *
 * This function is called at runtime when needed, which allows it to properly
 * detect the module location in both ESM and CJS contexts
 */
export function getCurrentDir(): string {
  // Try CommonJS __dirname first
  let moduleDir: string | null = null
  try {
    // eslint-disable-next-line no-eval
    moduleDir = eval('typeof __dirname !== "undefined" ? __dirname : null')
  } catch {
    // Not in CommonJS or eval failed
  }

  // Try to extract file location from Error stack (works in ESM)
  if (!moduleDir) {
    try {
      const stack = new Error().stack
      if (stack) {
        // Look for file:// URLs in the stack trace (ESM modules)
        // Stack trace format: "at <function> (file:///path/to/file.js:line:col)"
        const matches = stack.matchAll(/file:\/\/([^\s:)]+)/g)
        for (const match of matches) {
          if (match[1]) {
            const filePath = fileURLToPath('file://' + match[1])
            // Check if this path leads to our package
            const dir = path.dirname(filePath)
            // Try this directory and parents
            let testDir = dir
            for (let i = 0; i < 5; i++) {
              const jarPath = path.join(testDir, 'java/lib/jt400.jar')
              if (existsSync(jarPath)) {
                return testDir
              }
              const parentDir = path.dirname(testDir)
              if (parentDir === testDir) break
              testDir = parentDir
            }
          }
        }
      }
    } catch {
      // Stack parsing failed
    }
  }

  // If we found a module directory from __dirname, search from there
  if (moduleDir) {
    let testDir = moduleDir
    for (let i = 0; i < 5; i++) {
      const jarPath = path.join(testDir, 'java/lib/jt400.jar')
      if (existsSync(jarPath)) {
        return testDir
      }
      const parentDir = path.dirname(testDir)
      if (parentDir === testDir) break
      testDir = parentDir
    }
  }

  // Last resort: search up from process.cwd()
  let searchDir = process.cwd()
  for (let i = 0; i < 10; i++) {
    const jarPath = path.join(searchDir, 'java/lib/jt400.jar')
    if (existsSync(jarPath)) {
      return searchDir
    }
    const parentDir = path.dirname(searchDir)
    if (parentDir === searchDir) break
    searchDir = parentDir
  }

  // Fallback error
  throw new Error(
    `Could not locate package root with java/lib/jt400.jar. Searched from: ${moduleDir || process.cwd()}`,
  )
}
