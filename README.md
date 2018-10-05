# node-jt400
NodeJS JT400 wrapper to connect to IBM iSeries and AS/400 systems (OS400 operating system, database like DB2, programs and filesystem)

[![Version](https://img.shields.io/npm/v/node-jt400.svg)](https://npmjs.org/package/node-jt400)

## Install

```sh
npm install node-jt400 --save
```

#### Windows
Windows installations can be tricky because of node-java dependency. Make sure that that module works first. You can check out [the node-java documentation for windows installation](https://github.com/joeferner/node-java#installation-windows)

We also have some solved issues you can take a look at like [#13](https://github.com/tryggingamidstodin/node-jt400/issues/13) and [#26](https://github.com/tryggingamidstodin/node-jt400/issues/26)

Other issues might be related to node-gyp, python and MS build tools or VS IDE.

## Configure
Most basic configuration would be:
```javascript
const config = {
    host: 'myhost',
    user: 'myuser',
    password: 'xxx',
}
const pool = require('node-jt400').pool(config);
```
But the config accepts all [JT400 JDBC Properties](https://www.ibm.com/support/knowledgecenter/en/ssw_ibm_i_73/rzahh/javadoc/com/ibm/as400/access/doc-files/JDBCProperties.html) so you can add other options like `translate binary`
```javascript
const config = {
    host: 'myhost',
    user: 'myuser',
    password: 'xxx',
    'translate binary': 'true',
    trace: 'true',
}
const pool = require('node-jt400').pool(config);
```

# SQL / Database

## Query
###### Promises
```javascript
pool
  .query('SELECT field1, field2 FROM foo WHERE bar=? AND baz=?', [1, 'a'])
  .then(result => {
    console.log('result');
    const field1 = result[0].FIELD1;
    console.log(field1);
  })
  .fail(error => {
    console.log('error');
    console.log(error);
  });
```
###### Async/await
```javascript
try {
    const results = await pool.query('SELECT field1, field2 FROM foo WHERE bar=? AND baz=?', [1, 'a']);
    console.log('result');
    const field1 = result[0].FIELD1;
    console.log(field1);
}
catch (error) {
    console.log('error');
    console.log(error);
}
```

## Update
###### Promises
```javascript
pool
  .update('UPDATE foo SET bar=? WHERE baz=?', [1, 'a'])
  .then(nUpdated => {
    console.log('Updated ' + nUpdated + ' rows');
});
```
###### Async/await
```javascript
try {
    const rowsUpdated = await pool.update('UPDATE foo SET bar=? WHERE baz=?', [1, 'a']);
    console.log('rows updated');
    console.log(rowsUpdated);
}
catch (error) {
    console.log('error');
    console.log(error);
}
```

### Delete
###### Promises
```javascript
pool
  .update('DELETE FROM foo WHERE bar=?', [1])
  .then(nUpdated => {
    console.log('Deleted + ' nUpdated + ' rows');
});
```
###### Async/await
```javascript
try {
    const rowsDeleted = await pool.update('DELETE FROM foo WHERE bar=?', [1]);
    console.log('Deleted + ' rowsDeleted + ' rows');
}
catch (error) {
    console.log('error');
    console.log(error);
}
```

### Insert
###### Promises
```javascript
pool
  .insertAndGetId('INSERT INTO foo (bar, baz) VALUES(?,?)',[2,'b'])
  .then(id => {
    console.log('Inserted new row with id ' + id);
});
```
###### Async/await
```javascript
try {
    const id = await pool.insertAndGetId('INSERT INTO foo (bar, baz) VALUES(?,?)',[2,'b']);
    console.log('Inserted new row with id ' + id);
}
catch (error) {
    console.log('error');
    console.log(error);
}
```

### Insert list
###### Promises
```javascript
const tableName = 'foo';
const idColumn  = 'fooid';
const rows = [
    {FIELD1: 1, FIELD2: 'a'},
    {FIELD1: 2, FIELD2: 'b'}
];

pool
  .insertList(tableName, idColumn, rows)
  .then(listOfGeneratedIds => {
    console.log(listOfGeneratedIds);
});
```
###### Async/await
```javascript
try {
    const idList = await pool.insertList(tableName, idColumn, rows);
    console.log(idList);
}
catch (error) {
    console.log('error');
    console.log(error);
}
```

### Batch update
###### Promises
```javascript
//insert list in one statement
const data = [
    [1, 'a'],
    [2, 'b']
];

pool
  .batchUpdate('INSERT INTO FOO (FIELD1, FIELD2) VALUES(?,?)', data)
  .then(result => {
    console.log(result);
    //result is number of updated rows for each row. [1, 1] in this case.
});
```
###### Async/await
```javascript
try {
    const result = await pool.batchUpdate('INSERT INTO FOO (FIELD1, FIELD2) VALUES(?,?)', data);
    console.log(result);
    // result is the number of updated rows for each row. [1, 1] in this case.
}
catch (error) {
    console.log('error');
    console.log(error);
}
```
### SQL stream
```javascript
pool
  .createReadStream('SELECT FIELD1, FIELD2 FROM FOO WHERE BAR=? AND BAZ=?', [1, 'a'])
  .pipe(JSONStream.parse([true]))
  .pipe(pool.createWriteStream('INSERT INTO FOO2 (F1, F2) VALUES(?, ?)'));
```

### Transactions
Transaction is commited on success and rolled back on failure.
The transaction object has the same api as the pool object.

```javascript
pool.transaction(transaction => {
	const fooId = 1;
	
	return transaction.update('INSERT INTO FOO (FOOID, FIELD2) VALUES(?,?)', [fooId, 'a']).then(function() {
		return transaction.update('update BAR set FOOID=? where BARID=?', [fooId , 2])
	});
});
```

### Complex types
The node-jt400 module handles strings, longs, doubles and nulls automatically as types. When using other types like CLOB you need to specify the type specifically.
```javascript
pool
  .update('INSERT INTO foo (fooid, textfield, clobfield) VALUES(?, ?)', [1, 'text', {type:'CLOB',value:'A really long string'}])
  .then(() => {
    console.log('updated');
});
```

## Filesystem

### IFS read
```javascript
const ifs = pool.ifs();
const readStream = ifs.createReadStream('/foo/bar.txt') // readStream from IFS
```
As with any readable stream you can pipe it wherever you want. For example into the node filesystem.
```javascript
const createWriteStream = require('fs').createWriteStream
const join = require('path').join
const filename = join(__dirname, 'old.txt')
const writeStream = createWriteStream(filename) // writeStream to nodeJS filesystem.

const ifs = pool.ifs();
const readStream = ifs.createReadStream('/new.txt') // Reading bar.txt from IFS

readStream.pipe(writeStream)  // Piping from IFS to nodeJS
```

### IFS write
```javascript
const ifs = pool.ifs();
const writeStream = ifs.createWriteStream(('/foo/bar.txt')
```

As with any other writable streams you can pipe a readable stream into it.
```javascript
const fs = require('fs').createReadStream
const join = require('path').join
const filename = join(__dirname, 'old.txt')
const readStream = createReadStream(filename) // readStream from nodeJS filesystem

const ifs = pool.ifs();
const writeStream = ifs.createWriteStream('/new.txt')

readStream.pipe(writeStream) // Piping from nodeJS to IFS
```

You can see more examples in [issue #27](https://github.com/tryggingamidstodin/node-jt400/issues/27)

### IFS delete
```javascript
const ifs = pool.ifs();
ifs.deleteFile('/foo/bar.txt.old').then(console.log); // true or false
```

## Programs
With programs it is neccesary to define your input parameters first. Make sure that these match your program defination in AS
```javascript
const myProgram = pool.pgm('MYPROGRAM', [
            { type: 'DECIMAL', precision: 10, scale: 0, name: 'myId'},
            { type: 'NUMERIC', precision: 8, scale: 0, name: 'myDate'},
            { type: 'NUMERIC', precision: 12, scale: 2, name: 'myTotalValue' },
            { type: 'CHAR', precision: 32, scale: 0, name: 'myString'}
]);
```
You can then call it like a promise function with the parameters you defined.
```javascript
myProgram({
  myId: 123
  myDate: '20170608',
  myTotalValue: 88450.57,
  myString: 'This is a test'
})
.then(result => {
  console.log(result)
});
```
The Decimal type maps to com.ibm.as400.access.AS400PackedDecimal
The Numeric type maps to com.ibm.as400.access.AS400ZonedDecimal
Everything else (char) maps to com.ibm.as400.access.AS400Text

Precision is the size and scale is the decimals. 

## Message Files
IBM AS400Message Reference:

https://javadoc.midrange.com/jtopen/index.html?com/ibm/as400/access/MessageFile.html

```javascript
const file = await pool.openMessageFile({path:"/QSYS.LIB/YOURLIB.LIB/YOURMSGF.MSGF"});
let msg = await file.read({messageId:"AMX0051"}); // an IBM AS400Message Object
console.log('msg',msg.getTextSync());
console.log('msg',await msg.getTextPromise());
```