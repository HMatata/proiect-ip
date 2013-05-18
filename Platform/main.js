var express = require('express'),
    crypto = require('crypto'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
    mongo = require('mongodb').MongoClient,
    fs = require('fs');

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){});

server.listen(6001);

function hash(data) {
    var sha = crypto.createHash('sha1');
    sha.update(data);
    return sha.digest('base64');
}

mongo.connect("mongodb://localhost:27017/content", function(err, db) {
    if(err) { return console.dir(err); }
    console.log("Connected to mongo.");

    // Setting up storage for Redis
    var RedisStore = require('socket.io/lib/stores/redis'),
        redis = require('socket.io/node_modules/redis'),
        pub = redis.createClient(),
        sub = redis.createClient(),
        client = redis.createClient();

    io.set('store', new RedisStore({
        redis: redis,
        redisPub: pub,
        redisSub: sub,
        redisClient: client
    }));


    io.sockets.on('connection', function (socket) {
        socket.emit('init', {});
        //TODO: replace this with relevant code to get the games from the database
        socket.on('games:list', function () {
            fs.readFile('./public/games/games.json', { encoding: 'utf8'}, function (err, data){
                if (err) throw err;
                socket.emit('games:list', JSON.parse(data));
            });
        });

        socket.on('useradd', function(data) {
            data.password = hash(data.password);
            db.collection('users').insert(data, {w:1}, function(err, result) {}); //TODO: should do something with the return value
        });

        socket.on('auth', function(data) {
            data.password = hash(data.password);
            db.collection('users').findOne(data, function (err, doc) {
                if (doc == null)
                    socket.emit('error', {msg:"Authentification failed."});
                else {
                    socket.set('location', data, function () {
                        console.log("Saved user data on socket object.");
                    });
                    socket.emit('identify', doc); //TODO: Check if this is actually useful
                }
            });
        });
    });
});
