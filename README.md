# node-jt400
NodeJS JT400 wrapper to connect to IBM iSeries and AS/400 systems (OS400 operating system, database like DB2, programs and filesystem)

[![Version](https://img.shields.io/npm/v/node-jt400.svg)](https://npmjs.org/package/node-jt400)

## Install

```sh
npm install node-jt400 --save
```

## Configure

```javascript
const config = {
    host: 'myhost',
    user: 'myuser',
    password: 'xxx',
}
const pool = require('node-jt400').pool(config);
```
It will also accept [JT400 JDBC Properties](https://www.ibm.com/support/knowledgecenter/en/ssw_ibm_i_73/rzahh/javadoc/com/ibm/as400/access/doc-files/JDBCProperties.html).
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

## Promises

### Query
```javascript
pool.query('SELECT field1, field2 FROM foo WHERE bar=? AND baz=?', [1, 'a'])
  .then(function (result) {
    console.log('result');
    const field1 = result[0].FIELD1;	    
  })
  .fail(function (error) {
    console.log('error');
    console.log(error);
  });
```

### Update
```javascript
pool.update('UPDATE foo SET bar=? WHERE baz=?', [1, 'a']).then(function (nUpdated) {
    console.log('Updated ' + nUpdated + ' rows');
});
```

### Delete
```javascript
pool.update('DELETE FROM foo WHERE bar=?', [1]).then(function (nUpdated) {
    console.log('Deleted + ' nUpdated + ' rows');
});
```

### Insert
```javascript
pool.insertAndGetId('INSERT INTO foo (bar, baz) VALUES(?,?)',[2,'b']).then(function(id) {
    console.log('Inserted new row with id ' + id);
});
```

### Insert list
```javascript
const tableName = 'foo';
const idColumn  = 'fooid';
const rows = [
    {FIELD1: 1, FIELD2: 'a'},
    {FIELD1: 2, FIELD2: 'b'}
];

pool.insertList(tableName, idColumn, rows).then(function (listOfGeneratedIds) {
    console.log(listOfGeneratedIds);
});
```

### Batch update
```javascript
//insert list in one statement
const data = [
    [1, 'a'],
    [2, 'b']
];

pool.batchUpdate('INSERT INTO FOO (FIELD1, FIELD2) VALUES(?,?)', data).then(function (result) {
    console.log(result);
    //result is number of updated rows for each row. [1, 1] in this case.
});
```

### SQL stream
```javascript
pool.createReadStream('SELECT FIELD1, FIELD2 FROM FOO WHERE BAR=? AND BAZ=?', [1, 'a'])
  .pipe(JSONStream.parse([true]))
  .pipe(pool.createWriteStream('INSERT INTO FOO2 (F1, F2) VALUES(?, ?)'));
```

### Transactions
Transaction is commited on success and rolled back on failure.
The transaction object has the same api as the pool object.

```javascript
pool.transaction(function(transaction) {
	const fooId = 1;
	
	return transaction.update('INSERT INTO FOO (FOOID, FIELD2) VALUES(?,?)', [fooId, 'a']).then(function() {
		return transaction.update('update BAR set FOOID=? where BARID=?', [fooId , 2])
	});
});
```

### Complex types
The node-jt400 module handles strings, longs, doubles and nulls automatically as types. When using other types like CLOB you need to specify the type specifically.
```javascript
pool.update('INSERT INTO foo (fooid, textfield, clobfield) VALUES(?, ?)', [1, 'text', {type:'CLOB',value:'A really long string'}]).then(function() {
    console.log('updated');
});

```
## async / await

### Query
```javascript
try {
    const results = await pool.query('SELECT field1, field2 FROM foo WHERE bar=? AND baz=?', [1, 'a']);
    const field1 = result[0].FIELD1;
    console.log('result');
    console.log(field1);
}
catch (error) {
    console.log('error');
    console.log(error);
}
```

### Update
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
```javascript
const tableName = 'foo';
const idColumn  = 'fooid';
const rows = [
    {FIELD1: 1, FIELD2: 'a'},
    {FIELD1: 2, FIELD2: 'b'}
];

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
```javascript
// insert a list in one statement
const data = [
    [1, 'a'],
    [2, 'b']
];

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

## Filesystem

### IFS read/write
```javascript
const ifs = pool.ifs();
ifs.createReadStream('/foo/bar.txt').pipe(ifs.createWriteStream('/foo/bar2.txt'));
```

### IFS delete
```javascript
const ifs = pool.ifs();
ifs.deleteFile('/foo/bar.txt.old').then(console.log); // true or false
```

## Programs
```javascript
const myProgram = pool.pgm('MYPROGRAM', [
            { type: 'DECIMAL', precision: 10, scale: 0, name: 'myId'},
            { type: 'NUMERIC', precision: 8, scale: 0, name: 'myDate'},
            { type: 'NUMERIC', precision: 12, scale: 2, name: 'myTotalValue' },
            { type: 'CHAR', precision: 32, scale: 0, name: 'myString'}
]);


myProgram({
  myId: 123
  myDate: '20170608',
  myTotalValue: 88450.57,
  myString: 'This is a test'
}).then(function(result) {
  console.log(result)
});
```

The Decimal type maps to com.ibm.as400.access.AS400PackedDecimal
The Numeric type maps to com.ibm.as400.access.AS400ZonedDecimal
Everything else (char) maps to com.ibm.as400.access.AS400Text

Precision is the size and scale is the decimals. 