var express = require('express'),
    crypto = require('crypto'),
	app = express(),
	server = require('http').createServer(app),
    socketio = require('socket.io'),
    io = socketio.listen(server),
    mongo = require('mongodb').MongoClient,
    fs = require('fs'),
    nodemailer = require("nodemailer");


app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res){});


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
// gets read of the heartbeats from the log
io.set('log level', 2);
// we do not like flash
// Why?
io.set('transports', [ 'websocket', 'xhr-polling' ]);


// Using gmail. It works. Let it be.
var transport = nodemailer.createTransport("SMTP", {
    service: "Gmail",
    auth: {
        user: "proiect-ip@tudalex.com",
        pass: "placintacumere"
    }
});



var db = undefined;
mongo.connect("mongodb://localhost:27017/content", function(err, _db) {
    if(err) { return console.dir(err); }
    db = _db;
    console.log("Connected to mongo.");

    server.listen(process.argv[2], function() {
        console.log("Started serving on " + this._connectionKey);
    });
});



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




var UserManager = {
    registerUser: function(data) {
        data.password = hash(data.password);
        data.image = gravatar(data.email);
        data.confirmed = false;
        console.log(data);

        db.collection('users').insert(data, { w: 1 }, function(err, result) {
            if (err) {
                console.log("Error:",err);
                this.emit('user:signup', {'msg':err});
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
            transport.sendMail(email, function(error, response) {
                if (error) {
                    console.log(error);
                } else {
                    console.log("Message sent: " + response.message);
                }
            });
            console.log("Result",result);
            this.emit('user:signup', {msg:'ok'});
        }.bind(this));
    },

    resetPassword: function(data) {
        console.log("Resetting password for email", data);
        var new_password = crypto.pseudoRandomBytes(15).toString('base64').replace("/",'|').replace('+', '-');
        var new_pass_hash = hash(new_password);
        db.collection('users').update({ email: data }, { $set: { password: new_pass_hash } }, {w:1}, function (err, result) {

            if (result == null) {
                socket.emit('user:reset_password', { msg: "We couldn't find the email specified.", error: true });
                return;
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
                if (error) {
                    console.log(error);
                } else {
                    console.log("Message sent: " + response.message);
                }
            });
            this.emit('user:reset_password', {msg: "Password has been reset", error: false});
        });
    },

    verifyEmail: function(data) {
        console.log("Verify email for id", data);
        db.collection('users').update({_id: ObjectID(data)}, {$set: {confirmed: true}}, {w:1}, function(err, doc) {
            if (doc == null) {
                this.emit('user:verify_error', {msg: "Something failed badly."});
            }
            this.emit('user:verify', {});
        }.bind(this));
    },

    sendFeedback: function(data) {
        var email = {
            from: "proiect-ip@tudalex.com",
            to: "tudalex@gmail.com, gilca.mircea@gmail.com, gabriel.ivanica@gmail.com, alexei6666@gmail.com",
            subject: "Feedback",
            text: data
        };
        transport.sendMail(email, function(error, response){
            if (error) {
                console.log(error);
            } else {
                console.log("Message sent: " + response.message);
            }
        });
    }
};




var User = function(info) {
    this._id = info._id;
    this.name = info.username;
    this.sessions = [];

    delete info._id;
    delete info.password;
    this.info = info;
};


User.prototype = {
    update: function(socket, data) {
        //TODO: Implement password update here
        delete data._id;
        db.collection('users').update({ _id: this._id }, data, { w: 1 }, function(err, doc) {
            if (doc == null) {
                this.emit('user:error', { msg: "Something failed badly." });
            }
        }.bind(socket));
    },

    addSession: function(session) {
        this.sessions.push(session);
    },

    getInfo: function() {
        return this.info;
    }
}





var Session = function(id) {
    this.id = id;
    this.sockets = [];
}

Session.prototype = {
    bindSocket: function(socket) {
        this.sockets.push(socket);
        socket.session = this;

        var msg = {};
        msg.ssid = this.id;

        if (this.user) {
            socket.switchToClass('loggedin');
            msg.info = this.user.getInfo();
        }
        else {
            socket.switchToClass('guest');
        }

        socket.emit('session:info', msg);
    },

    bindUser: function(socket, user) {
        this.user = user;
        user.addSession(this)

        var msg = {};
        msg.info = user.getInfo();

        for (var i in this.sockets) {
            //this.sockets[i].emit('session:info', msg);
            this.sockets[i].switchToClass('loggedin');
        }
        socket.emit('session:info', msg);
    }
};

var SessionManager = function() {
    this.users = {};
    this.sessions = {};

    var self = this;
    var getSession = function(id) {
        function generateSsid() {
            return '123';
        }
        var session = self.sessions[id];
        if (session == undefined) {
            id = generateSsid();
            session = new Session(id);
            self.sessions[id] = session;
        }
        return session;
    };

    return {
        identify: function(socket, ssid) {
            var session = getSession(ssid);
            session.bindSocket(socket);
        },

        authenticate: function(socket, username, password) {
            console.log("Auth request " + username + ":" + password);
            password = hash(password);
            //console.log(password);
            db.collection('users').findOne({ username: username }, function (err, doc) {
                if (doc == null || doc.password != password) {
                    console.log("Not found");
                    socket.emit('session:error', { msg: 'Invalid credentials' });
                    return;
                }
                var user = self.users[username];
                if (user == undefined) {
                    user = new User(doc);
                    self.users[username] = user;
                }
                var session = socket.session;
                session.bindUser(socket, user);
            });
        }
    };
}();


// Monkey-patching is evil so we dynamically upgrade sockets as the connect
// by swapping their __proto__ to a one that implements our new methods
var ExtendedSocketProto = Object.create(socketio.Socket.prototype);

var ExtendSocket = function(socket, cls) {
    socket.__proto__ = ExtendedSocketProto;
    socket.setup();
    socket.enableEventClass(cls);
}

ExtendedSocketProto.setup = function() {
    this.enabledClasses = {};
    this.rooms = [];
}

// The object this in the following functions is going to refer to the extended
// socket object
ExtendedSocketProto.classEvents = {
    alien: {
        session: {
            identify: function(ssid) {
//                console.log("Got identify");
//                console.dir(ssid);
                SessionManager.identify(this, ssid);
            }
        }
    },
    guest: {
        user: {
            verify: UserManager.verifyEmail,
            reset_password: UserManager.resetPassword,
            feedback: UserManager.sendFeedback,

            register: function(data) {
                data.password = hash(data.password);
                data.image = gravatar(data.email);
                console.log("Adding user " + data);

                db.collection('users').insert(data, { w: 1 }, function(err, result) {
                    if (err) {
                        console.log("Error:", err);
                        this.emit('user:signup', { msg: err });
                        return;
                    }
                    console.log(result);
                    this.emit('user:signup', { msg: 'ok' });
                });
            },

            auth: function(data) {
                var username = data.username;
                var password = data.password;
                SessionManager.authenticate(this, username, password);
            }
        }
    },
    loggedin: {
        user: {   // Can't we automagically register all the user functions here? I mean the functions defined in the
                  // user
            feedback: UserManager.sendFeedback,

            update: function(data) {
                this.session.user.update(this, data);
            },

            logout: function() {
                this.session.user.logout(); //TODO: Actually implement this function
            }
        },
        chat: {
            message: function(data) {
                var room = data.room;
                var message = data.message;
                this.broadcast.to(room).emit('chat:message', {
                    room: room,
                    name: this.session.user.name,
                    text: message
                });
            },
            join: function(data) {
                var room = data.room.replace('/','');
                this.join(room);
                this.rooms[room] = true;
                this.broadcast.to(room).emit('chat:join', {
                    room: room,
                    name: this.session.user.name
                });

            },
            leave: function(data) {
                var room = data.room.replace('/','');
                this.leave(data.room);
                delete this.rooms[room];
                this.broadcast.to(room).emit('chat:leave', {
                    room: room,
                    name: this.session.user.name
                });
            }
        }
    }
};

ExtendedSocketProto.enableEventClass = function(cls) {
    var events = this.classEvents[cls];
    for (var ns in events) {
        for (var ev in events[ns]) {
            var ev_name = ns + ':' + ev;
            this._events[ev_name] = events[ns][ev];
        }
    }
    this.enabledClasses[cls] = true;
}

ExtendedSocketProto.disableEventClass = function(cls) {
    var events = this.classEvents[cls];
    for (var ns in events) {
        for (var ev in events[ns]) {
            var ev_name = ns + ':' + ev;
            delete this._events[ev_name];
        }
    }
    delete this.enabledClasses[cls];
}

ExtendedSocketProto.switchToClass = function(new_cls) {
    for (var old_cls in this.enabledClasses) {
        this.disableEventClass(old_cls);
    }
    this.enableEventClass(new_cls);
}

io.sockets.on('connection', function (socket) {
    // Upgrade the socket
    ExtendSocket(socket, 'alien');
    //socket.emit('init', {});
    //console.dir(socket._events);

    socket.on('games:list', function () {
        db.collection('games', function(err, collection) {
            if(err) throw err;

            collection.find({}, function(err, cursor) {
                if(err) throw err;

                cursor.toArray( function(err, items) {
                    if(err) throw err;
                    // NOTE: Ugly hack for design
                    var result = [];
                    for(var i = 0, len = items.length; i < len; i+=3) {
                        var chk = {};
                        chk[i]   = items[i];
                        chk[i+1] = items[i+1];
                        chk[i+2] = items[i+2];
                        result.push( chk );
                    }
                    //console.log(result);
                    socket.emit('games:list', result );
                });
            });
        });
    });

    socket.on('games:gameId', function (data) {
        db.collection('games').findOne( { id : data }, function(err, item) {
            socket.emit('games:gameId', item );
        });
    });

    // when a client calls the 'socket.close()'
    // function or closes the browser, this event
    // is built in socket.io so we actually dont
    // need to fire it manually
    socket.on('disconnect', function(){
        console.log('disconnect triggered');
    });
});
