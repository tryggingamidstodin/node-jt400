import { defineConfig } from 'tsdown'
import { writeFileSync } from 'fs'
import { join } from 'path'

export default defineConfig([
  // ESM build
  {
    entry: ['ts-src/**/*.ts'],
    format: ['esm'],
    outDir: 'dist-esm',
    sourcemap: true,
    dts: true,
    unbundle: true,
    clean: true,
    target: 'es2022',
    outExtensions: () => ({ js: '.js' }),
    deps: { neverBundle: true },
    hooks: {
      'build:done': () => {
        writeFileSync(
          join('dist-esm', 'package.json'),
          JSON.stringify({ type: 'module' }, null, 2),
        )
      },
    },
  },
  // CJS build
  {
    entry: ['ts-src/**/*.ts'],
    format: ['cjs'],
    outDir: 'dist-cjs',
    sourcemap: true,
    dts: true,
    unbundle: true,
    target: 'es2022',
    outExtensions: () => ({ js: '.js' }),
    deps: { neverBundle: true },
    hooks: {
      'build:done': () => {
        writeFileSync(
          join('dist-cjs', 'package.json'),
          JSON.stringify({ type: 'commonjs' }, null, 2),
        )
      },
    },
  },
])
