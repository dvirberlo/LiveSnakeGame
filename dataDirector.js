const { Client } = require('pg');
var mainTable = 'test_table';
var mainConnectionS = '';

function queryData(cmd, callback){
	const client = new Client({connectionString: mainConnectionS,ssl: true,});
	client.connect();
	client.query(cmd, (err, response) => {
		if (err)throw err;
		client.end();
		if(typeof(callback) === 'function')callback(response);
	});
}

module.exports = {
	set: function(table, connectionS){
		mainTable = table;
		mainConnectionS = connectionS;
	},
	load: function(callback){
		queryData('select * from ' + mainTable, (res)=>{
			var rowsArr = Array.isArray(res.rows) ? res.rows : [res.rows];
			if(typeof(callback) === 'function')callback(rowsArr);
		});
	},
	update: function(obj, by = 'id', what = '*'){
		var cmd = 'update ' + mainTable + ' set ';
		for(var key in obj){
			if(key !== by && (key == what || what == '*')){
				if(typeof(obj[key]) === 'string')cmd += key + '=\'' + obj[key] + '\',';
				else cmd += key + '=' + obj[key] + ',';
			}
		}
		cmd = cmd.slice(0, cmd.length -1);
		cmd += ' where ' + by + '=' + obj[by];
		console.log(cmd);
		queryData(cmd);
	},
	insert: function(obj){
		var cmd = 'insert into ' + mainTable + '(';
		for(var key in obj){
			cmd += key + ',';
		}
		cmd = cmd.slice(0, cmd.length -1);
		cmd += ') values(';
		for(var key in obj){
			var t = typeof(obj[key]);
			if(t === 'string')cmd += '\'' + obj[key] + '\',';
			else cmd += obj[key] + ',';
		}
		cmd = cmd.slice(0, cmd.length -1);
		cmd += ');';
		console.log(cmd);
		queryData(cmd);
	}
};