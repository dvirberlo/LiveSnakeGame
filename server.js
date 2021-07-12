'use strict';

const express = require('express');
const SocketServer = require('ws').Server;
const path = require('path');
const fs = require('fs');
const dataDirector = require('./dataDirector.js');
dataDirector.set('test_table', process.env.DATABASE_URL);

const PORT = process.env.PORT || 3000;
//const INDEX = path.join(__dirname, 'index.html');

// Main Server:
var requests = {};
// Game Server:
const STATUS = {'OFF':0, 'ON':1, 'NAMED':2, 'CONNECTED':3};
const BOOLEAN = {'TRUE':'+', 'FALSE':'-'};
const TYPE = {'STATUS':'$', 'NAME':'@', 'GAME':'%', 'START':'&', 'APPLE':'*', 'MOVE':'#', 'LIST':'~'};
var arr = {};
var snakes = {};
var source = {};
const grid = 16;
const canvasS = 25;
var apple = {'x':getRandomInt(0, canvasS) * grid, 'y':getRandomInt(0, canvasS) * grid};

const server = express()
	.use(express.static(path.join(__dirname, 'public')))
	.set('views', path.join(__dirname, 'views'))
	.set('view engine', 'ejs')
	.get('/', (req, res) => res.render('pages/index'))
	.get('/ejs/db', (req, res) => res.render('pages/db'))
	.get('/ejs/', (req, res) => res.render('pages/index'))
	.get('/db', (req, res) => {
		dataDirector.load((response) => {
				res.set({'Content-Type':'application/json'});
				res.send(JSON.stringify(response));
				if(req.query.insert){
					var cmd;
					try{
						cmd = JSON.parse(req.query.insert);
						dataDirector.insert(JSON.parse(req.query.insert))
					}
					catch(err){
						res.send('\n' + err.toString());
					}
					res.end();
				}
				else if(req.query.update){
					dataDirector.update(JSON.parse(req.query.update));
				}
			});
	})
	.get('/id', (req, res) => {
		var origin = req.query.origin;
			var d = new Date();
			var timeout = d.setMinutes(d.getMinutes() + 5);
			var id = randS4();
			requests[id] = {'timeout':timeout, 'origin':origin, 'status':0};
			res.set({'Content-Type': 'text/plain','Access-Control-Allow-Origin': ['https://buylist.000webhostapp.com']});
			res.send(id.toString());
			res.end();
	})
	.listen(PORT, () => {
		console.log(strDate()+`Listening on ${ PORT }`);
	})
	

const wss = new SocketServer({ server });
wss.on('connection', (ws) => {
	const conTime = Date.now();
	const origin = ws.upgradeReq.headers.origin;
	const path = ws.upgradeReq.url;
	// Main Server:
	if(path.indexOf("/ws") === 0){
		if(path.indexOf("/ws?id=") === 0 && requests[path.replace("/?id=","")]!==undefined&&requests[path.replace("/?id=","")].origin===origin&&requests[path.replace("/?id=","")].timeout>conTime){
			const id = path.replace("/?id=","");
			ws.id  = id;
			requests[id].status = 1;
			ws.on('close', () => {
				requests[id].status = 0;
				delete requests[id];
				console.log(strDate()+'clients['+wss.clients.length+'] disconnected or terminated | origin:'+origin);
			});
			// client->server: ?->. @-># || server->client: $->%
			ws.on('message', (message) => {
				if(message.toString().length > 1000 || requests[id].timeout < Date.now) ws.terminate();
				if(message === '?1'){
					var Dto = new Date(requests[id].timeout);
					Dto.setMinutes(Dto.getMinutes() + 3);
					requests[id].timeout = Dto.getTime();
					ws.send('.1');
				}
				if(message.indexOf("@1") === 0){
					const msg = message.split('@')[2];
					
					ws.send('#1');
				}
				else ws.send(Date.now() + '|got: ' + message);
			});
		}
		else return ws.terminate();
	}// Game Server:
	else if (path.indexOf("/game") === 0){
		const id = randS4();
		ws.id = id;
		arr[id] = {};
		arr[id].Qstarted = Date.now();
		arr[id].Qid = id;
		arr[id].ws = ws;
		arr[id].Qstatus = STATUS.ON;
		arr[id].Qname = '';
		arr[id].FQid = null;
		ws.send('$'+STATUS.ON);
		
		ws.on('close', () => {
			arr[id].Qstatus = STATUS.OFF;
			if (arr[id].FQid){
				arr[arr[id].FQid].FQid = null;
				arr[arr[id].FQid].Qstatus = STATUS.NAMED;
				arr[arr[id].FQid].ws.send('$' + STATUS.NAMED);
			}
			console.log(strDate()+'GameServer: arr['+id+'].ws disconnected or terminated');
			delete arr[id];
			delete snakes[id];
			delete source[id];
		});
		ws.on('message', (message) => {
			if(message.indexOf(TYPE.MOVE) === 0){
				moveS(message.replace(TYPE.MOVE, ''), id);
			}
			else if(message.indexOf(TYPE.NAME) === 0){
				arr[id].Qname = message.replace(TYPE.NAME, '').toString();
				ws.send(BOOLEAN.TRUE);
				arr[id].Qstatus = STATUS.NAMED;
				ws.send('$' + STATUS.NAMED);
			}
			else{
				ws.send('!');
			}
		});
	}
	else return ws.terminate();
});

// Game Server:
setInterval(() => {
	for(var key in arr){//console.log(JSON.stringify({'Qid':arr[key].Qid, 'Qname':arr[key].Qname, 'Qstatus':arr[key].Qstatus, 'FQid':arr[key].FQid}));
		if(arr[key].Qstatus === STATUS.NAMED){
			arr[key].ws.send('$' + STATUS.CONNECTED);
			snakes[key]={'cells':[], 'color':randColor()};
			arr[key].Qsnake = {'dx':grid, 'dy':0, 'maxCells':4, 'x':getRandomInt(0, canvasS)*grid, 'y':getRandomInt(0, canvasS)*grid};
			source[key] = {'val':0, 'color':snakes[key].color, 'name':arr[key].Qname};
			arr[key].ws.send(TYPE.START + JSON.stringify({'color':snakes[key].color, 'apple':apple}));
			arr[key].Qstatus = STATUS.CONNECTED;
		}
	}
}, 2000);
setInterval(() => {
	var Jsource = JSON.stringify(Object.values(source));
	for(var key in arr){
		if(arr[key].Qstatus === STATUS.CONNECTED){
			arr[key].ws.send(TYPE.LIST + Jsource);
		}
	}
}, 10000);
setInterval(() => {
	for(var key in arr){
		if(arr[key].Qstatus === STATUS.CONNECTED){
			snakeMove(key, snakes);
		}
	}
}, 100);
setInterval(() => {
	var Jsnakes = JSON.stringify(Object.values(snakes));
	for(var key in arr){
		if(arr[key].Qstatus === STATUS.CONNECTED){
			try{
				arr[key].ws.send(TYPE.GAME + Jsnakes);
			}catch(err){}
		}
	}
}, 100);
function snakeMove(key, sns){
	arr[key].Qsnake.x += arr[key].Qsnake.dx;
	arr[key].Qsnake.y += arr[key].Qsnake.dy;
	// wrap snake position on edge of screen
	if (arr[key].Qsnake.x < 0) {
		arr[key].Qsnake.x = grid*canvasS - grid;
	}else if (arr[key].Qsnake.x >= grid*canvasS) {
		arr[key].Qsnake.x = 0;
	}
	if (arr[key].Qsnake.y < 0) {
		arr[key].Qsnake.y = grid*canvasS - grid;
	} else if (arr[key].Qsnake.y >= grid*canvasS) {
		arr[key].Qsnake.y = 0;
	}
	// keep track of where snake has been. front of the array is always the head
	snakes[key].cells.unshift({x:arr[key].Qsnake.x, y:arr[key].Qsnake.y});
	// remove cells as we move away from them
	if (snakes[key].cells.length > arr[key].Qsnake.maxCells) {
		snakes[key].cells.pop();
	}
	snakes[key].cells.forEach(function(cell, index) {
		// snake ate apple
		if (cell.x === apple.x && cell.y === apple.y) {
			arr[key].Qsnake.maxCells++;
			source[key].val += 10;
			newApple();
		}
		// check collision with all cells after this one (modified bubble sort)
        for (var i = index + 1; i < snakes[key].cells.length; i++) {
			// collision. reset game ?? or not, just reset position and  dicreace some points.
			if ((cell.x === snakes[key].cells[i].x && cell.y === snakes[key].cells[i].y) || checkO(snakes[key], sns)) {
				arr[key].Qsnake.x = getRandomInt(0, canvasS)*grid;
				arr[key].Qsnake.y = getRandomInt(0, canvasS)*grid;
				snakes[key].cells = [];
				arr[key].Qsnake.maxCells = 4;
				arr[key].Qsnake.dx = grid;
				arr[key].Qsnake.dy = 0;
				if(source[key].val <= 30)source[key].val = 0;
				else source[key].val -= 30;
            }
        }
	});
}
function checkO(snk, obS){
	for(var key in obS){
		if(obS[key].color !== snk.color){
			for(var j = 0; j < obS[key].cells.length; j++){
				if(obS[key].cells[j].x === snk.cells[0].x && obS[key].cells[j].y === snk.cells[0].y){
					return true;
				}
			}
		}
	}
	return false;
}
function newApple(){
	apple = {'x':getRandomInt(0, 25) * grid, 'y':getRandomInt(0, 25) * grid};
	for(var key in arr){
		arr[key].ws.send(TYPE.APPLE + JSON.stringify(apple));
	}
}
function moveS(e, key){
	if (e == 37 && arr[key].Qsnake.dx === 0) {
		arr[key].Qsnake.dx = -grid;
		arr[key].Qsnake.dy = 0;
	}
	else if (e == 38 && arr[key].Qsnake.dy === 0) {
		arr[key].Qsnake.dy = -grid;
		arr[key].Qsnake.dx = 0;
	}
	else if (e == 39 && arr[key].Qsnake.dx === 0) {
		arr[key].Qsnake.dx = grid;
		arr[key].Qsnake.dy = 0;
	}
	else if (e == 40 && arr[key].Qsnake.dy === 0) {
		arr[key].Qsnake.dy = grid;
		arr[key].Qsnake.dx = 0;
	}
}
/* function getSnakes(){
	var array = [];
	for(var key in arr){
		if(arr[key].Qsnake)array.push(arr[key].Qsnake);
	}
	return array;
} */
/* function getList(){
	var array = [];
	for(var key in arr){
		if(arr[key].Qsnake)array.push({'name':arr[key].Qname, 'source':source[key], 'color':arr[key].Qsnake.color});
	}
	return array;
} */

// Main Server
setInterval(() => {
	wss.clients.forEach((client) => {
		if(client.id === undefined){// if client is not Game Server's
			client.send(new Date().toTimeString());
			var id = client.id;
			if(requests[id] === undefined || requests[id].timeout <= Date.now()){
				client.terminate();
			}
		}
	});
}, 1000);
setInterval(() => {
	var now = Date.now();
	for(var key in requests){
		if(requests[key].timeout < now){
			if(requests[key].status === 0)delete requests[key];
		}
	}
}, 5000);

process.on('exit', (code) => {
	console.log(strDate()+`About to exit with code: ${code}`);
});

function rand(now, i){
	if(i === 2)return null;
	i++;
	var s = parseInt(now*Math.random());
	if(requests[s] === undefined)return s;
	return rand(now, i);
}
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}
function s4() {
	return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
}
function randS4() {
	return s4() + s4() + s4() + s4() + '';
}
function randColor(){
	// return 'rgb(' + getRandomInt(0, 255) + ',' + getRandomInt(0, 255) + ',' + getRandomInt(0, 255) + ')';
	return rgbToHex(getRandomInt(0, 255), getRandomInt(0, 255), getRandomInt(0, 255));
}
function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}
function strDate(d){
	// (d/m/yyyy	h:min:sec:mls)::
	return '('+d.getDate()+'/'+d.getMonth()+'/'+d.getFullYear()+' '+d.getHours()+':'+d.getMinutes()+':'+d.getSeconds()+':'+d.getMilliseconds()+')::';
}
function strDate(){
	var d = new Date();
	return '('+d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear()+' '+d.getHours()+':'+d.getMinutes()+':'+d.getSeconds()+':'+d.getMilliseconds()+')::';
}