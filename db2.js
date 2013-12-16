'use strict';
var java = require('java');

java.classpath.push(__dirname + '/java/lib/jt400.jar');
java.classpath.push(__dirname + '/java/lib/jt400wrap.jar');
java.classpath.push(__dirname + '/java/lib/json-simple-1.1.1.jar');

function init(config) {
	var DB2 = java.import('nodejt400.DB2').getInstanceSync(JSON.stringify(config));
	return {
		executeQuery: function (sql, cb) {
			DB2.executeQuery(sql, function (err, data) {
				if(err){
					cb(err);
				}
				else {
					cb(null, JSON.parse(data));
				}
			});
		},
	};
}

module.exports = {
	init: init
};
