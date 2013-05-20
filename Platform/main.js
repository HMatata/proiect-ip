var express = require('express'),
    crypto = require('crypto'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
    mongo = require('mongodb').MongoClient,
    fs = require('fs');

var PP = require('prettyprint');
    //cookie_parser = require('cookie');

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){});

server.listen(6001);


function hash(data) {
    var sha = crypto.createHash('sha1');
    sha.update(data);
    return sha.digest('base64');
}

function gravatar(email) {
    var md5 = crypto.createHash('md5');
    md5.update(email.trim().toLowerCase());
    return "http://www.gravatar.com/avatar/"+md5.digest('hex');
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


            db.collection('games', function(err, collection){
                if(err) throw err;

                collection.find( {}, function(err, cursor){
                    if(err) throw err;

                    cursor.toArray( function(err, items){
                        if(err) throw err;

                        socket.emit('games:list', items );

                    });
                });
            });

//            fs.readFile('./games/games.json',
//                { encoding: 'utf8'}, function (err, data){
//                if (err) throw err;
//                socket.emit('games:list', JSON.parse(data));
//            });
        });

        socket.on('user:add', function(data) {
            data.password = hash(data.password);
            data.image = gravatar(data.email);
            console.log(data);

            db.collection('users').insert(data, {w:1}, function(err, result) {
                if (err) {
                    console.log("Error:",err);
                    return;
                }
                console.log(result);
                socket.emit('user:signup', {msg:'ok'});
            });
        });

        socket.on('user:auth', function(data) {
            data.password = hash(data.password);
            db.collection('users').findOne(data, function (err, doc) {
                if (doc == null) {
                    socket.emit('user:error', {msg:"Authentification failed."});
                }
                else {
                    socket.emit('user:identify', doc); //TODO: Check if this is actually useful
                }
            });
        });


        // broadcast a user's message to other users
        socket.on('send:message', function (data) {
            socket.broadcast.emit('send:message', {
                text: data.message
            });
        });

        // clean up when a user leaves, and broadcast it to other users
        socket.on('disconnect', function () {
            socket.broadcast.emit('user:left', {
                name: "gogu"
            });
        });
    });
});
