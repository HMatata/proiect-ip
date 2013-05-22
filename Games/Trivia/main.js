var express = require('express');

var	app = express();

var	server = require('http').createServer(app);
var	io = require('socket.io').listen(server);
var redis = require("redis");


/*
 * Start server
 */

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){});

server.listen(6004);

/*
 * Database
 */
redis.debug_mode = true;

var client = redis.createClient();

client.on("error", function (err) {
    console.log("Error " + err);
});

var RedisClient = {
	
	getNewClient : function(callback) {
		client.incr('userid', function(err, reply) {
			console.log("new client err: " + err);
			console.log("new client reply: " + reply);
			RedisClient.setNewClient(reply, callback);
		});
	},
	
	setNewClient : function(id, callback) {
		console.log("User" + id + " added in the DB");
		client.set('user' + id, JSON.stringify({id: id, nick: 'guest'+id}), function (err, reply) { 
			RedisClient.getClient(id, callback);
		});
	},
	
	getClient: function(id, callback) {
		client.get("user" + id, function (err, reply) {
			console.log("err: ",err);
			console.log("get client reply: ", reply);
			if (reply != null) {
				console.log("Callback",callback);
				callback(reply);
			}
			else {
				RedisClient.getNewClient(callback);
			} 
	    });
	}
}


var RedisQuestions = {
	
	question : {},
	
	getQuestionNR : function () {
		client.get("question" + Chat.question, function (err, reply) {
			RedisQuestions.question_nr = reply;
		});
	},
	
	getQuestion : function(callback) {
		client.get("question" + Chat.question, function (err, reply) {
			if (reply != null) {
				console.log("Callback", callback);
				callback(reply);
				question = reply;
			}
		});
	},
	
	sendNextQuestion : function() {
		client.get("question" + Chat.question, function (err, reply) {
			io.sockets.emit('chat', reply);
			question = reply;
		});
	},
	
	addQuestion : function(data) {
		client.incr('question_nr', function(err, reply) {
			data.id = reply;
			client.set("question" + reply, JSON.stringify(data));
		});
	},
	
	verifyQuestion : function(data) {
		var status = 'FALSE';
		client.get("user" + data.cid, function (err, reply) {
			if (RedisQuestions.question.id == data.qid && RedisQuestions.question.right == data.ans)
				status = 'OK';
				
			io.sockets.emit('answer', {nick: reply.nick, status: status});	
		});
	}
};


/*
 * 
 */

var Chat = {
	connections: 0,
	question : -1,
	time: 0,
	
	stop: function () {
			
	},

	next: function () {
		Chat.question++;
		if (Chat.question == 4)
			Chat.question = 1;
		RedisQuestions.sendNextQuestion();
		time = setTimeout(Chat.next, 10000);		
	},
	
	start: function () {
		this.question = 1;
		time = setTimeout(Chat.next, 10000);
	},
};



io.sockets.on('connection', function (socket) {
	
	console.log('New Client Connected');

	Chat.connections++;
	
	if (Chat.connections == 1)
		Chat.start();
		
	RedisQuestions.getQuestion(function (data){
		socket.emit('chat', data);
	});

	socket.on('authenticate', function(data) {
		console.log('Authectication key : ' + data);
		
		if (data.length == 0)
			data = RedisClient.getNewClient(function (data) { 
				socket.emit('authenticate', data);
			});
		else {
			RedisClient.getClient(data, function (data) {
				socket.emit('authenticate', data);
			}); 
		}
	});

	socket.on('login', function(data) {
		console.log(JSON.stringify(data));
		
	});
	
	socket.on('chat', function (data) {
			
/*		console.log("Question : " + qset[Chat.question]);
		
		if (data.qID == qset[Chat.question].a) {
			emitToAll(data + ' : corect');
			Chat.next();
		}
		else {
			emitToAll(data + ' : gresit');
		}
*/
	});
	
	socket.on('disconect', function() {
		Chat.connections--;
		if (Chat.connections == 0) {
			Chat.stop();
		}
	});
	
});


function genQuestion(question, anwsers, right) {
	this.id = 0;
	this.question = question;
	this.answers = anwsers;
	this.right = right;
}

function emitToAll(msg) {
	io.sockets.emit('chat', msg);
}

RedisQuestions.addQuestion(new genQuestion("You're last chance", ["No", "OK", "Die potato"], 2));
RedisQuestions.addQuestion(new genQuestion("2 + 2", ["4", "7", "N-am facut mate"], 0));
RedisQuestions.addQuestion(new genQuestion("Space", ["..?", "WAT?", "Of course!"], 1));






