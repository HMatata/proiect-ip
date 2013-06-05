var express = require('express');

var	app = express();

var	server = require('http').createServer(app);
var	io = require('socket.io').listen(server);
var redis = require("redis");
var mongo = require('mongodb').MongoClient;

var http  = require('http');

var name = 'trivia';

var Database_Backend = {

    backend_link : 'http://dev5.tudalex.com:7781/',
    app_id : -1,

    get_app_id: function( name, callback ){

        console.log( Database_Backend.backend_link + "get_app_id/" + name );

        http.get( Database_Backend.backend_link + "get_app_id/" + name, function(res) {

            console.log( "Got response: " + res.statusCode);
            console.log( "Stuffy" + console.dir(res) );

            var pageData = "";
            res.on('data', function(chunk){
                pageData += chunk;
            });

            res.on('end', function(){

               var response = eval(pageData);
               console.log(response[0]);

               Database_Backend.app_id = response[0].app_id;
               console.log( "app_id :" + Database_Backend.app_id );

            })

        }).on('error', function(e) {
                console.log("Got error: " + e.message);
        });

        callback();
    }
};


/*
 * Start server
 */

app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res){});

server.listen(process.argv[2]);

console.log("whuaza");

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
		client.set('user' + id, JSON.stringify({id: id, nick: 'guest'+id}), function () {
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
};


var RedisQuestions = {

	question : {},
    max_count : 0,

    gen_query_id : function() {
        return  (Math.floor( (Math.random() * 100) + 1 ) % this.max_count) + 1;
    },

	getQuestionNR : function ( callback ) {
		client.get("question_nr", function (err, reply) {
			RedisQuestions.max_count = reply;
            callback();
		});
	},

	getQuestion : function(callback) {

		client.get("question" + this.gen_query_id(), function (err, reply) {
			if (reply != null) {
				console.log("Callback", callback);
				callback(reply);
				question = reply;
			}
		});

	},

	sendNextQuestion : function() {

		client.get("question" + this.gen_query_id(), function (err, reply) {
			io.sockets.emit('chat', reply);
			question = reply;
		});

	},

	addQuestion : function(data) {

        client.set("question" + data.id, JSON.stringify(data));

        if( data.id > RedisQuestions.max_count ){
            client.incr('question_nr', function(err, reply) {
                console.log('incr scrappy');
                RedisQuestions.max_count = reply;
            });
        }

	},

	verifyQuestion : function(data) {       // ??

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
	round_it : 0,
    round_count : 5,

    timeout: 1000,
    connections: 0,

	stop: function () {

	},

	next: function () {

        Chat.round_it = Chat.round_it + 1;

        if( Chat.round_it == Chat.round_count ){ // ??
            Chat.round_it = 0;
        }

        console.log("round_it : "+ Chat.round_it );

        RedisQuestions.sendNextQuestion();
		time = setTimeout(Chat.next, Chat.timeout);
	},

	start: function () {

        RedisQuestions.getQuestionNR( function(){

            update_cache();
            this.round_it = 0;
            time = setTimeout(Chat.next, Chat.timeout);

        });
	}
};

var db = undefined;

var Database = {

    connect_to_db : function (callback){

            mongo.connect("mongodb://localhost:27017/content", function(err, database) {

            if(err) {
                console.log(err);
                return;
            }

            console.log("Connected to mongo.");

            db = database;
            callback();
        });

    }
}


function update_cache(){

    scrape_collection( 'triviaq', {}, {}, function( items ){

        console.log('Got it:' + JSON.stringify( items[0] ) );

        console.log( RedisQuestions.max_count + "  " + items.length );

        for (var i = RedisQuestions.max_count; i < items.length; ++i) {
            RedisQuestions.addQuestion( items[i] );
        }

    });
}

function scrape_collection( coll, query, opt, callback ){

    var dbg = "Sorted Scrape: " + coll + ": " + JSON.stringify(query) + " " + JSON.stringify(opt);
    console.log( dbg );

    db.collection( coll ).find( query, opt ).sort( {id:1} , function(err, cursor){
        if( err ) throw err;

        cursor.toArray( function(err, items){
            if( err ) throw err;

            console.log( items );
            callback( items );
        });

    });
}

Database_Backend.get_app_id( name, function(){

    Database.connect_to_db( function(){

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
                    data = RedisClient.getNewClient(function (data) { // ??
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

            /*
                console.log("Question : " + qset[Chat.question]);

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
    });
});

function emitToAll(msg) {
	io.sockets.emit('chat', msg);
}

//
//function genQuestion(question, answers, right) {
//    this.id       = 0;
//    this.right    = right;
//    this.answers  = answers;
//    this.question = question;
//}
//RedisQuestions.addQuestion(new genQuestion("You're last chance", ["No", "OK", "Die potato"], 2));
//RedisQuestions.addQuestion(new genQuestion("2 + 2", ["4", "7", "N-am facut mate"], 0));
//RedisQuestions.addQuestion(new genQuestion("Space", ["..?", "WAT?", "Of course!"], 1));




