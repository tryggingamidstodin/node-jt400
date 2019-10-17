# Changelog
All notable changes to this project will be documented in this file. Please note that this changelog was added in version 4.0 so documentation on versions prior to that are incomplete.

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