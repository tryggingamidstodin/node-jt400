# Changelog
All notable changes to this project will be documented in this file. Please note that this changelog was added in version 4.0 so documentation on versions prior to that are incomplete.

## [4.0.1] - 2019-10-20
### Added
 - Added new a Java class (```Cmd```) to ```nodejt400```.
    - The new ```Cmd``` class enables the ability execute single commands by implementing the JT400 Java class [CommandCall](https://sourceforge.net/p/jt400/svn/HEAD/tree/trunk/src/com/ibm/as400/access/CommandCall.java).
    - The new ```Cmd``` class was made using the ```Pgm``` class as a template.
 - Added ```executeCmd``` javascript function to enable the use of the new ```Cmd``` Java Class.
    - The new function works in a similar manner as the function returned from ```defineProgram```.
    - Instead of defining a command first then executing it, you do both at once.

Example:
```javascript
const connPool = as400.pool(config);

//Sets my Library List to include the command I need.
connPool.executeCmd({cmdString:'SETLIBL LIBDFT'})
.then(res=>{
    console.log(res)
    // { '0': 'Library list changed to system LIBDFT for user *GENERIC' }
    connPool.executeCmd({cmdString:'CRTLIB TSTLIB'})
        .then(res=>console.log(res))
         //{ '0': 'Library TSTLIB created.' }
        .fail(res=>console.log(res))
})
.fail(res=>console.log(res))
```

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