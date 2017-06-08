node-jt400
=====

nodejs jt400 wrapper

## Configure

```javascript
const pool = require('node-jt400').pool({host: 'myhost', user: 'myuser', password: 'xxx'});
```

## SQL query

```javascript
pool.query('SELECT FIELD1, FIELD2 FROM FOO WHERE BAR=? AND BAZ=?', [1, 'a'])
.then(function (result) {
	const field1 = result[0].FIELD1;
	...
});

```
## SQL stream

```javascript
pool.createReadStream('SELECT FIELD1, FIELD2 FROM FOO WHERE BAR=? AND BAZ=?', [1, 'a'])
.pipe(JSONStream.parse([true]))
.pipe(pool.createWriteStream('INSERT INTO FOO2 (F1, F2) VALUES(?, ?)'));

```
## SQL update

```javascript
pool.update('update FOO set BAR=? WHERE BAZ=?', [1, 'a'])
.then(function (nUpdated) {
    ...
});

```
## SQL insert

```javascript
//insert list in one statement
const tableName = 'foo',
    idColumn  = 'fooid',
    rows = [
        {FIELD1: 1, FIELD2: 'a'},
        {FIELD1: 1, FIELD2: 'a'}
    ];
pool.insertList(tableName, idColumn, rows)
.then(function (listOfGeneratedIds) {
    ...
});

```
## SQL batch update

```javascript
//insert list in one statement
const data = [
        [1, 'a'],
        [2, 'b']
    ];
pool.batchUpdate('INSERT INTO FOO (FIELD1, FIELD2) VALUES(?,?)', data)
.then(function (result) {
    //result is number of updated rows for each row. [1, 1] in this case.
});

```

## Transactions
```javascript
pool.transaction(function(transaction) {
	const fooId = 1;

	//transaction object has the same api as the pool object.
	//The transaction is commited on success and rolled back on failure.
	return transaction.update('INSERT INTO FOO (FOOID, FIELD2) VALUES(?,?)', [fooId, 'a']).then(function() {
		return transaction.update('update BAR set FOOID=? where BARID=?', [fooId , 2])
	});
});

```

## IFS read/write
```javascript
const ifs = pool.ifs();
ifs.createReadStream('/foo/bar.txt').pipe(ifs.createWriteStream('/foo/bar2.txt'));
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