#!/usr/bin/env node

/**
 * Simulates real consumers installing this package via node_modules
 * and resolving it through package.json "exports".
 */

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const pkgRoot = dirname(fileURLToPath(import.meta.url))
const failures = []

const run = async (label, fn) => {
  console.log(`… ${label}`)
  try {
    await fn()
    console.log(`✓ ${label}`)
  } catch (error) {
    failures.push(label)
    console.error(`✗ ${label}`)
    console.error(error)
  }
}

const setupConsumer = async ({ type } = {}) => {
  const dir = await mkdtemp(join(tmpdir(), 'node-jt400-consumer-'))
  await writeFile(
    join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'node-jt400-consumer',
        private: true,
        ...(type ? { type } : {}),
      },
      null,
      2,
    ),
  )
  await mkdir(join(dir, 'node_modules'))
  await symlink(pkgRoot, join(dir, 'node_modules', 'node-jt400'))
  return dir
}

const runNode = (cwd, file, args = []) => {
  const result = spawnSync(process.execPath, [file, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 20000,
  })
  if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
    throw new Error(
      `node ${relative(pkgRoot, file)} timed out in ${cwd}\n${result.stdout}\n${result.stderr}`,
    )
  }
  if (result.status !== 0) {
    throw new Error(
      `node ${relative(pkgRoot, file)} failed in ${cwd}\n${result.stdout}\n${result.stderr}`,
    )
  }
  return result.stdout
}

const resolveTypes = (consumerDir, containingFile, compilerOptions) => {
  const host = ts.createCompilerHost(compilerOptions)
  const originalGetCurrentDirectory = host.getCurrentDirectory.bind(host)
  host.getCurrentDirectory = () => consumerDir || originalGetCurrentDirectory()
  const resolved = ts.resolveModuleName(
    'node-jt400',
    containingFile,
    compilerOptions,
    host,
  )
  return resolved.resolvedModule?.resolvedFileName
}

await run('CJS consumer require() uses dist-cjs, not dist-esm', async () => {
  const dir = await setupConsumer()
  try {
    const script = join(dir, 'consumer.cjs')
    await writeFile(
      script,
      `
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const resolved = require.resolve('node-jt400')
assert.match(resolved, /\\${sep}dist-cjs\\${sep}/)
assert.doesNotMatch(resolved, /\\${sep}dist-esm\\${sep}/)

const entry = fs.readFileSync(resolved, 'utf8')
assert.doesNotMatch(entry, /import\\.meta/)

const javaIndex = path.join(path.dirname(resolved), 'java', 'index.js')
const javaSrc = fs.readFileSync(javaIndex, 'utf8')
assert.doesNotMatch(javaSrc, /import\\.meta/)
assert.match(javaSrc, /__filename/)

const jarDir = path.join(path.dirname(resolved), '..', 'java', 'lib')
assert.equal(path.resolve(jarDir), path.resolve(${JSON.stringify(join(pkgRoot, 'java', 'lib'))}))
assert.doesNotMatch(path.resolve(jarDir), /\\${sep}dist-esm\\${sep}/)

console.log(JSON.stringify({
  resolved,
  jarDir: path.resolve(jarDir),
}))
`,
    )
    const output = runNode(dir, script)
    const { resolved, jarDir } = JSON.parse(output.trim().split('\n').at(-1))
    console.log(`  resolved: ${relative(pkgRoot, resolved)}`)
    console.log(`  jarDir:   ${relative(pkgRoot, jarDir)}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

await run('CJS consumer can load the package and create a pool', async () => {
  const dir = await setupConsumer()
  try {
    const script = join(dir, 'consumer.cjs')
    await writeFile(
      script,
      `
const { pool } = require('node-jt400')
const connection = pool({
  host: 'test-host',
  user: 'test-user',
  password: 'test-password',
})
if (typeof connection !== 'object' || connection === null) {
  throw new Error('pool() did not return an object')
}
console.log('loaded')
process.exit(0)
`,
    )
    const output = runNode(dir, script)
    assert.match(output, /loaded/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

await run('CJS consumer from a different cwd still resolves dist-cjs', async () => {
  const dir = await setupConsumer()
  try {
    const script = join(dir, 'consumer.cjs')
    await writeFile(
      script,
      `
const resolved = require.resolve('node-jt400')
if (!resolved.includes('${sep}dist-cjs${sep}')) {
  throw new Error('expected dist-cjs, got ' + resolved)
}
console.log(resolved)
`,
    )
    const output = runNode(tmpdir(), script)
    assert.match(output, /dist-cjs/)
    assert.doesNotMatch(output, /dist-esm/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

await run('ESM consumer import() uses dist-esm', async () => {
  const dir = await setupConsumer({ type: 'module' })
  try {
    const script = join(dir, 'consumer.mjs')
    await writeFile(
      script,
      `
import assert from 'node:assert/strict'

const resolved = import.meta.resolve('node-jt400')
assert.match(resolved, /\\/dist-esm\\//)
assert.doesNotMatch(resolved, /\\/dist-cjs\\//)
console.log(resolved)
`,
    )
    const output = runNode(dir, script)
    assert.match(output, /dist-esm/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

await run('ESM createRequire() still gets the CJS build', async () => {
  const dir = await setupConsumer({ type: 'module' })
  try {
    const script = join(dir, 'consumer.mjs')
    await writeFile(
      script,
      `
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const resolved = require.resolve('node-jt400')
assert.match(resolved, /\\${sep}dist-cjs\\${sep}/)
assert.doesNotMatch(resolved, /\\${sep}dist-esm\\${sep}/)
assert.doesNotMatch(readFileSync(resolved, 'utf8'), /import\\.meta/)
console.log(resolved)
`,
    )
    const output = runNode(dir, script)
    assert.match(output, /dist-cjs/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

await run('TypeScript node16 CJS consumer types resolve to dist-cjs', async () => {
  const dir = await setupConsumer()
  try {
    const containingFile = join(dir, 'consumer.ts')
    await writeFile(containingFile, "import { pool } from 'node-jt400'\n")
    const resolved = resolveTypes(dir, containingFile, {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node16,
    })
    assert.ok(resolved, 'TypeScript did not resolve node-jt400')
    assert.match(resolved, /dist-cjs/)
    assert.doesNotMatch(resolved, /dist-esm/)
    console.log(`  types: ${relative(pkgRoot, resolved)}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

await run('TypeScript node16 ESM consumer types resolve to dist-esm', async () => {
  const dir = await setupConsumer({ type: 'module' })
  try {
    const containingFile = join(dir, 'consumer.mts')
    await writeFile(containingFile, "import { pool } from 'node-jt400'\n")
    const result = spawnSync(
      join(pkgRoot, 'node_modules', '.bin', 'tsc'),
      [
        '--module',
        'nodenext',
        '--moduleResolution',
        'nodenext',
        '--noEmit',
        '--traceResolution',
        '--pretty',
        'false',
        containingFile,
      ],
      { encoding: 'utf8', timeout: 20000 },
    )
    if (result.status !== 0 && !result.stdout.includes('was successfully resolved')) {
      throw new Error(result.stdout + result.stderr)
    }
    assert.match(
      result.stdout,
      /successfully resolved to '.*dist-esm\/index\.d\.ts'/,
    )
    assert.doesNotMatch(
      result.stdout,
      /successfully resolved to '.*dist-cjs\/index\.d\.ts'/,
    )
    console.log('  types: dist-esm/index.d.ts')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

await run('classic TypeScript resolution still follows the types field', async () => {
  const dir = await setupConsumer()
  try {
    const containingFile = join(dir, 'consumer.ts')
    await writeFile(containingFile, "import { pool } from 'node-jt400'\n")
    const resolved = resolveTypes(dir, containingFile, {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
    })
    assert.ok(resolved, 'TypeScript did not resolve node-jt400')
    console.log(`  types: ${relative(pkgRoot, resolved)}`)
    if (resolved.includes(`${sep}dist-esm${sep}`)) {
      console.log(
        '  note: moduleResolution: node uses the top-level "types" field (dist-esm). That is separate from the shims issue.',
      )
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

await run('bundlers that honor "module" still see dist-esm', async () => {
  const pkg = JSON.parse(await readFile(join(pkgRoot, 'package.json'), 'utf8'))
  assert.equal(pkg.module, 'dist-esm/index.js')
  const moduleEntry = await readFile(join(pkgRoot, pkg.module), 'utf8')
  assert.doesNotMatch(moduleEntry, /import\.meta/)
  console.log(
    '  note: webpack/legacy bundlers using the "module" field still load ESM. The ESM entry no longer contains a leaked import.meta.url shim.',
  )
})

await run('published package files include both builds', async () => {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: pkgRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout)
  }
  const packed = JSON.parse(result.stdout)
  const files = packed[0].files.map((file) => file.path)
  for (const required of [
    'dist-cjs/index.js',
    'dist-cjs/package.json',
    'dist-cjs/java/index.js',
    'dist-esm/index.js',
    'dist-esm/package.json',
  ]) {
    assert.ok(files.includes(required), `missing from pack: ${required}`)
  }
  const distCjsPackage = JSON.parse(
    await readFile(join(pkgRoot, 'dist-cjs', 'package.json'), 'utf8'),
  )
  assert.equal(distCjsPackage.type, 'commonjs')
})

if (failures.length > 0) {
  console.error(`\n${failures.length} consumer check(s) failed`)
  process.exit(1)
}

console.log('\nAll consumer checks passed')
