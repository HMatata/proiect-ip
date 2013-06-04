var express = require('express');
var app = express();
var server = require('http').createServer(app);
var	io = require('socket.io').listen(server);
var PP = require('prettyprint');


app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){});

server.listen(process.argv[2]);


var Game = {
	connections : 0,
	users : [],
	rooms : {},
	lastRoom : null,
	updateID : null,
	ball : {
		speed : 0.01,
		increment :0.00005
	}
}

Game.init = function init(room) {

	var data = Game.rooms[room].data;

	data.ball = {};
	data.ball.x = 0.50;
	data.ball.y = 0.25;
	data.status = -1;
	data.players = [{}, {}];

	data.dirx = 0.01 + Math.random();
	if (Math.random() < 0.5)
		data.dirx *= -1;
	data.diry = 0.8;

}

Game.update = function (room) {

	var data = Game.rooms[room].data;
	var posx = data.ball.x + Game.ball.speed * data.dirx;
	var posy = data.ball.y + Game.ball.speed * data.diry;

	if (posx > 0.95 || posx < 0.05) {
		data.dirx *= -1;
		data.ball.speed += Game.ball.increment;
	}

	if (posy > 0.95)
		data.status = 0;

	if (posy < 0.05)
		data.status = 1;

	if (data.status !== -1) {
		console.log("Game ended! Player", data.status, "wins!");
		clearInterval(Game.rooms[room].data.updateID);
	}

	if (Math.abs(posy - 0.9) < 0.05 &&
		Math.abs(posx - data.players[0].pos) < 0.15)
		data.diry *=-1;

	if (Math.abs(posy - 0.1) < 0.05 &&
		Math.abs(posx - data.players[1].pos) < 0.15)
		data.diry *=-1;

	data.ball.x = posx;
	data.ball.y = posy;

	io.sockets.in(room).emit('sync', data);
}

var unic = 0;

io.sockets.on('connection', function (socket) {

	console.log("CLIENT SOCKET ID: ", socket.id);
	console.log("NR OF USERS: ", io.sockets.clients().length);

	io.sockets.clients().forEach(function (socket) {
		console.log(socket.id);
	});

	var room;
	var host = true;

	// FIND the first AVAILABLE ROOM
	for (var roomID in Game.rooms) {
		if (Game.rooms[roomID].players == 1) {
			host = false

			socket.join(Game.rooms[roomID].name);
			Game.rooms[roomID].sockets[1] = socket;
			Game.rooms[roomID].players = 2;
			room = roomID;
			break;
		}
	}

	// CRATE A ROOM IF NO AVAILABLE ROOM EXIST
	if (host) {
		room = 'room' + socket.id;
		socket.join(room);
		Game.rooms[room] = {};
		Game.rooms[room].name = room;
		Game.rooms[room].players = 1;
		Game.rooms[room].sockets = [];
		Game.rooms[room].sockets[0] = socket;
		Game.rooms[room].data = {};
		Game.rooms[room].data.players = [];
		socket.emit('initGame', null);
	}

	else {
		socket.emit('syncGame', Game.rooms[room].data);
	}

	socket.on('player1Sync', function(data) {
		Game.rooms[room].data.players[0] = data;
	});

	socket.on('player2Sync', function(data) {
		
		console.log("Connected player 2");
		
		Game.rooms[room].data.players[1] = data;
		Game.init(room);
		io.sockets.in(room).emit('startGame', Game.rooms[room].data);
		
		Game.rooms[room].data.updateID = setInterval(Game.update, 16, room);
	});

	socket.on('sync', function(data) {
		Game.rooms[room].data.players[data.id] = data;
	});

	socket.on('disconnect', function () {
		delete Game.rooms[room];
	});

});
