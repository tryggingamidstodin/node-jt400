# Changelog

All notable changes to this project will be documented in this file. Please note that this changelog was added in version 4.0 so documentation on versions prior to that are incomplete.

## [Unreleased]

### Changed

- **Required Node.js versions:** `^22.22.2 || ^24.15.0 || >=26.0.0` (was `>=22`). Older Node 22 releases, Node 23 and Node 25 are no longer supported.
- Streams are now wired with `stream.pipeline` instead of `pipe`, so errors propagate and resources are cleaned up when a stream is closed or destroyed early.
- Types are stricter (`strict`, no implicit any), which may surface new compile errors in consumers.

### Fixed

- Pooled connections that are dead when handed out (SQL state `08xxx`) are now discarded and retried (up to 4 times) instead of failing the query.
- In-memory (hsql) connections are now closed when returned. Call `close()` on an in-memory client when done (see README).
- Streams that are closed while not reading no longer leak.

## [8.0.0] - 2026-11-13

### Changed

- Resource leak fixes in query/IFS read/write streams, and the Java jar was rebuilt. Streams now clean up the underlying Java objects when destroyed.
- `JSONStream` was replaced with an internal JSON array parser (no longer a dependency).
- Optional logger support is covered by additional tests.

## [7.0.0] - 2026-08-21

### Changed

- CommonJS compatibility: the package ships both `dist-esm` and `dist-cjs` and exposes them through `exports` (`import` / `require`). Minimum Node.js version raised.

## [6.0.0] - 2025-10-16

### Changed

- The package was converted to ESM (with a dual ESM/CommonJS build, see 7.0.0). Build output moved from `dist` to `dist-esm` / `dist-cjs`.

## [5.4.0] - 2025-07-28

### Added

- Optional logging, and the `Logger` interface is exported.

## [5.3.0] - 2025-07-11

New statement function created: asObjectStream. This returns a stream of object array instead of array values (asStream)

## [5.0.2] - 2024-05-30

We had to revert form java-bridge back to the java dependency because of deadlock issues.

## [5.0.0] - 2024-04-18

### Changed

- The java dependency was replaced with java-bridge.
- main was moved from dist/lib/jt400.js to dist/index.js
- Q promises replaced with native promises
- The full java object is no longer exposed when reading a message file

## [4.3.0] - 2021-08-01

### Added

- Options parameter added to the query function. Trimming values is now configurable, but still defaults to true. Issue [#22](https://github.com/tryggingamidstodin/node-jt400/issues/22).

## [4.2.0] - 2021-07-30

### Added

- Support for BLOB column (not only clob). See [#66](https://github.com/tryggingamidstodin/node-jt400/pull/66)

## [4.1.0] - 2021-03-12

### Added

- asIterable function added for async iterable support. See [#60](https://github.com/tryggingamidstodin/node-jt400/pull/60).
- new types and interfaces added.

## [4.0.0] - 2019-10-15

### Added

- All errors wrapped in [oops-error](https://github.com/tryggingamidstodin/oops-error).
- Created CHANGELOG.md.

### Changed

- Removed System.err logs in Java code.
- deprecated message for .pgm changed

## [3.1.3] - 2019-07-10

### Added

- ccsid option for program calls. See [#39](https://github.com/tryggingamidstodin/node-jt400/pull/39).

### Changed

- ccsid defaults to ccsid from as400 system.

## [3.0.0] - 2018-11-30

### Added

- defineProgram function.
- Default timeout on program calls set to 3 sec to avoid programs halting.
- Optional timeout parameter set to program calls.

### Changed

- Function .pgm was deprecated in favour of defineProgram.

## [2.0.0] - 2018-10-8

### Added

### Changed

- Only supports node verison 8 and higher.

## [1.5.4] - 2017-10-24

### Added

- Support for CLOB data type
