# Changelog

All notable changes to this project will be documented in this file. Please note that this changelog was added in version 4.0 so documentation on versions prior to that are incomplete.

## [Unreleased]

### Added

- `createDataQ` for plain (sequential, non-keyed) data queues, with `write`, `read` and `peek`. The queue is given by `name` (found in the library list) or by `path` (see README). The types `DataQ`, `DataQPathOptions` and `DataQWaitOptions` are exported.

### Fixed

- Plain data queues work with direct connections as well as pools.
- `parseJsonArray` respects downstream backpressure and rejects malformed array syntax and trailing content. Empty input and early termination between elements are still accepted.
- JDBC streams wait for Java resource cleanup before ending, including when closed during a pending read.

## [8.0.0] - 2026-11-13

### Added

- Errors caused by a SQL exception now carry structured diagnostics on `error.context.sqlError`: `sqlState`, `errorCode` and `chained` (the exceptions behind `getNextException`). Use these instead of matching on the error message (see README). The types `SqlErrorInfo` and `ChainedSqlError` are exported.
- The IFS read buffer size can be set with the `JT400_IFS_READ_BUFFER` environment variable or the `jt400.ifs.readBuffer` Java system property (see README).
- `parseJsonArray` is exported. It turns the output of `createReadStream` into a stream of rows, skips `null` elements and fails when the input ends in the middle of an element (see README).

### Changed

- **Required Node.js versions:** `^22.22.2 || ^24.15.0 || >=26.0.0` (was `>=22`). Older Node 22 releases, Node 23 and Node 25 are no longer supported.
- `JSONStream` was replaced with the internal JSON array parser `parseJsonArray`. `JSONStream` and `flushwritable` are no longer dependencies, so add them to your own dependencies if you relied on them being installed with this package.
- Streams are now wired with `stream.pipeline` instead of `pipe`, so errors propagate and resources are cleaned up when a stream is closed or destroyed early.
- Types are stricter (`strict`, no implicit any), which may surface new compile errors in consumers. The `rows` argument of `insertList` is now typed as `Record<string, Param>[]` (was `any[]`).
- IFS read streams read the file in chunks of up to 65536 bytes (was 10000), which means fewer round trips to the server. The `data` events of `ifs().createReadStream` carry larger chunks as a result.
- The Java jar was rebuilt.

### Fixed

- Resource leaks in query and IFS read/write streams. Streams now clean up the underlying Java objects when they are destroyed or closed, also while not reading.
- Connection config values that are not strings (e.g. `'block size': 512` or `prompt: false`) are now passed to the driver. They were silently ignored before, so only string values such as `'512'` took effect. If your config contains such values they will start to apply. `host`, `user` and `password` may also be given as non-strings.
- Pooled connections that are dead when handed out (SQL state `08003`) are now discarded and retried (up to 4 times) instead of failing the query. A rejected sign-on (`08004`) or a failed connect (`08001`) is not retried.
- In-memory (hsql) connections are now closed when returned, so they no longer pile up as open sessions.
- `execute` returns its connection to the pool when the statement fails, also when closing the failed statement fails.

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
