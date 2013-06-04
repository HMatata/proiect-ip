var express = require('express'),
    crypto = require('crypto'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
    mongo = require('mongodb').MongoClient,
    ObjectID = require('mongodb').ObjectID,
    fs = require('fs'),
    nodemailer = require("nodemailer");


// Sendmail, uncomment for backup purpouses
//var transport = nodemailer.createTransport("sendmail");

// Using gmail. It works. Let it be.
var transport = nodemailer.createTransport("SMTP",{
    service: "Gmail",
    auth: {
        user: "proiect-ip@tudalex.com",
        pass: "placintacumere"
    }
});



var PP = require('prettyprint');

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){});

server.listen(6001);


function hash(data) {
    var sha = crypto.createHash('sha1');
    sha.update(data);
    return sha.digest('base64').replace("/",'|').replace('+', '-');
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
        socket.on('games:list', function () {

            db.collection('games', function(err, collection){
                if(err) throw err;

                collection.find( {}, function(err, cursor){
                    if(err) throw err;

                    cursor.toArray( function(err, items){
                        if(err) throw err;

                        var result = [];
                        for (var i = 0, len = items.length; i < len; i+=3 ) {
                            var chk = {};
                            chk[i]   = items[i];
                            chk[i+1] = items[i+1];
                            chk[i+2] = items[i+2];

                            result.push( chk );
                        }

                        console.log(result);

                        socket.emit('games:list', result );

                    });
                });
            });
        });

        socket.on('games:gameId', function (data) {
            db.collection( 'games' ).findOne( { id : data }, function( err, item ){
                socket.emit('games:gameId', item );
            });
        });

        socket.on('user:add', function(data) {
            data.password = hash(data.password);
            data.image = gravatar(data.email);
            data.confirmed = false;
            console.log(data);

            db.collection('users').insert(data, {w:1}, function(err, result) {
                if (err) {
                    console.log("Error:",err);
                    socket.emit('user:signup', {'msg':err});
                    return;
                }
                var email = {
                    from: "proiect-ip@tudalex.com",
                    to: result[0].email,
                    subject: "Verify your email",
                    generateTextFromHTML: true,
                    html: "Va puteti activa contul facand click pe acest link: <a href='http://dev5.tudalex.com/#/verify_email/"+result[0]._id+"'>http://dev5.tudalex.com/#/verify_email/"+result[0]._id+"</a>"
                };
                console.log("Email", email);
                transport.sendMail(email, function(error, response){
                    if(error){
                        console.log(error);
                    }else{
                        console.log("Message sent: " + response.message);
                    }
                });
                console.log("Result",result);
                socket.emit('user:signup', {msg:'ok'});

            });
        });

        socket.on('user:auth', function(data) {
            data.password = hash(data.password);
            data.confirmed = true; // This checks if the mail account was confirmed
            db.collection('users').findOne(data, function (err, doc) {
                if (doc == null) {
                    socket.emit('user:error', {msg:"Authentification failed."});
                }
                else {
                    socket.emit('user:identify', doc);
                }
            });
        });

        socket.on('user:update', function (data) {
            console.log(data);
            var id = data._id;
            delete data._id;
            db.collection('users').update({_id: ObjectID(id)}, data, {w:1}, function(err, doc) {
               if (doc == null) {
                   socket.emit('user:error', {msg: "Something failed badly."});
               }
            });


        });

        socket.on('user:verify', function (data) {
            console.log("Verify email for id", data);
            db.collection('users').update({_id: ObjectID(data)}, {$set: {confirmed: true}}, {w:1}, function(err, doc) {
                if (doc == null) {
                    socket.emit('user:verify_error', {msg: "Something failed badly."});
                }
                socket.emit('user:verify', {});
            });
        });


        socket.on('user:reset_password', function (data) {
            console.log("Resetting password for email", data);
            var new_password = crypto.pseudoRandomBytes(16).toString('base64').replace("/",'|').replace('+', '-');
            var new_pass_hash = hash(new_password);
            db.collection('users').update( {email: data }, {$set: { password: new_pass_hash}}, {w:1}, function (err, result) {

                if (result == null) {
                    socket.emit('user:reset_password', {msg: "We couldn't find the email specified."});
                }
                var email = {
                    from: "proiect-ip@tudalex.com",
                    to: data,
                    subject: "Your password has been reset",
                    generateTextFromHTML: true,
                    html: "Parola dumneavoastra a fost resetata. Noua parola este <b>"+new_password+"</b>"
                };
                console.log("Email", email);
                transport.sendMail(email, function(error, response){
                    if(error){
                        console.log(error);
                    }else{
                        console.log("Message sent: " + response.message);
                    }
                });
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
