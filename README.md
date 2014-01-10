jt400
=====

nodejs jt400 wrapper

## Configure

```javascript
var jt400 = require('jt400').configure({host: 'myhost', user: 'myuser', password: 'xxx'});
```

## SQL query

```javascript
jt400.query('SELECT FIELD1, FIELD2 FROM FOO WHERE BAR=? AND BAZ=?', [1, 'a'])
.then(function (result) {
	var field1 = result[0].FIELD1;
	...
});

```
