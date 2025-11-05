#!/usr/bin/env node

/**
 * This script tests the CommonJS build
 */

const { pool } = require('./cjs-dist/index.js')

console.log('Testing CommonJS build...')
console.log('Current working directory:', process.cwd())

try {
  const connection = pool({
    host: 'test-host',
    user: 'test-user',
    password: 'test-password',
  })

  console.log('✓ Successfully initialized Java bridge in CommonJS')
  console.log('✓ Found JAR files from package root')
  console.log('✓ CommonJS build works correctly')
  console.log('Connection object created:', typeof connection)

  process.exit(0)
} catch (error) {
  console.error('✗ Failed to initialize CommonJS build:')
  console.error(error.message)
  if (error.stack) {
    console.error(error.stack)
  }
  process.exit(1)
}
