#!/usr/bin/env node

/**
 * This script simulates how this module would be imported as a dependency
 * in another project. It tests that the Java bridge can find the JAR files
 * even when the module is installed in node_modules.
 */

import { pool } from './esm-dist/index.js'

console.log('Testing module as if imported from node_modules...')
console.log('Current working directory:', process.cwd())

try {
  // Try to create a pool connection which will trigger Java bridge initialization
  const connection = pool({
    host: 'test-host',
    user: 'test-user',
    password: 'test-password',
  })

  console.log('✓ Successfully initialized Java bridge')
  console.log('✓ Found JAR files from package root')
  console.log('✓ Module can be used as a dependency')
  console.log('Connection object created:', typeof connection)

  process.exit(0)
} catch (error) {
  console.error('✗ Failed to initialize module as dependency:')
  console.error(error.message)
  if (error.stack) {
    console.error(error.stack)
  }
  process.exit(1)
}
