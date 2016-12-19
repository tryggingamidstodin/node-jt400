node-jt400
=====

nodejs jt400 wrapper

## Configure

```javascript
var pool = require('node-jt400').pool({host: 'myhost', user: 'myuser', password: 'xxx'});
```

## SQL query

```javascript
pool.query('SELECT FIELD1, FIELD2 FROM FOO WHERE BAR=? AND BAZ=?', [1, 'a'])
.then(function (result) {
	var field1 = result[0].FIELD1;
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
var tableName = 'foo',
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
var data = [
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
	var fooId = 1;

	//transaction object has the same api as the pool object.
	//The transaction is commit on success and rolled back on failure.
	return transaction.update('INSERT INTO FOO (FOOID, FIELD2) VALUES(?,?)', [fooId, 'a']).then(function() {
		return transaction.update('update BAR (NAME) set FOOID=? where BARID=?)', [fooId , 2])
	});
});

```

## IFS read
```javascript
var ifs = pool.ifs();
ifs.createReadStream('/foo/bar.txt');

```
