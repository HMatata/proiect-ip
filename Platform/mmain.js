var express = require('express'),
    crypto = require('crypto'),
	app = express(),
	server = require('http').createServer(app),
    socketio = require('socket.io'),
    io = socketio.listen(server),
    mongo = require('mongodb').MongoClient,
    fs = require('fs');

var PP = require('prettyprint');
    //cookie_parser = require('cookie');

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
io.set('transports', [ 'websocket', 'xhr-polling' ]);





var db = undefined;
mongo.connect("mongodb://localhost:27017/content", function(err, _db) {
    if(err) { return console.dir(err); }
    db = _db;
    console.log("Connected to mongo.");

    server.listen(6001, function() {
        console.log("Started serving on " + this._connectionKey);
    });
});



function hash(data) {
    var sha = crypto.createHash('sha1');
    sha.update(data);
    return sha.digest('base64').replace("/",'|');
}

function gravatar(email) {
    var md5 = crypto.createHash('md5');
    md5.update(email.trim().toLowerCase());
    return "http://www.gravatar.com/avatar/"+md5.digest('hex');
}






var User = function(info) {
    this._id = info._id;
    this.name = info.username;
    this.sessions = [];
    delete info._id;
    this.info = info;
};


User.prototype = {
    update: function(data) {
        db.collection('users').update({ _id: this._id }, data, { w: 1 }, function(err, doc) {
            if (doc == null) {
                this.emit('user:error', { msg: "Something failed badly." });
            }
        });
    },

    addSession: function(session) {
        this.sessions.append(session);
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
        this.sockets.append(socket);
        socket.session = this;

        var msg = {};
        msg.ssid = this.id;

        if (this.user) {
            socket.switchToClass('loggedin');
            msg.loggedin = true;
            msg.info = this.user.getInfo();
        }
        else {
            socket.switchToClass('guest');
            msg.loggedin = false;
        }

        socket.emit('session:info', msg);
    },

    bindUser: function(user) {
        this.user = user;
        user.addSession(this)

        var msg = {};
        msg.loggedin = true;
        msg.info = user.getInfo();

        for (var i in this.sockets) {
            this.sockets[i].emit('session:info', msg);
         }
    }
};








var SessionManager = function() {
    //private stuff
    this.users = [];
    this.sessions = [];

    var manager = this;
    var getSession = function(id) {
        function generateSsid() {
            return 0;
        }
        var session = this.sessions[id];
        if (session == undefined) {
            id = generateSsid();
            session = new Session(id);
            this.session[id] = session;
        }
    };

    return {
        identify: function(socket, ssid) {
            var session = getSession(ssid);
            session.bindSocket(socket);
        },

        authenticate: function(socket, username, password) {
            password = hash(password);
            db.collection('users').findOne({ username: username }, function (err, doc) {
                if (doc == null || doc.password != password) {
                    this.emit('session:error', { msg: 'Username or password not valid' });
                    return;
                }

                var user = manager.users[username];
                if (user == undefined) {
                    user = new User(doc);
                    manager.users[username] = user;
                }
                var session = socket.session();
                session.bindUser(user);
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

ExtendedSocketProto.classEvents = {
    alien: {
        session: {
            identify: function(data) {
                var ssid = data.ssid;
                SessionManager.identify(this, ssid);
            }
        }
    },
    guest: {
        user: {
            register: function(data) {
                data.password = hash(data.password);
                data.image = gravatar(data.email);
                console.log("Adding user " + data);

                db.collection('users').insert(data, { w: 1 }, function(err, result) {
                    if (err) {
                        console.log("Error:",err);
                        this.emit('user:signup', {'msg':err});
                        return;
                    }
                    console.log(result);
                    this.emit('user:signup', {msg:'ok'});
                });
            },
            auth: function(data) {
                var username = data.username;
                var password = data.password;
                this.user.auth(username, password);
            }
        }
    },
    loggedin: {
        user: {
            update: function(data) {
                this.user.update(data);
            },
            logout: function() {
                this.user.logout();
            }
        },
        chat: {
            message: function(data) {
                var room = data.room;
                var message = data.message;
                this.broadcast.to(room).emit('chat:message', {
                    name: this.user.name,
                    text: message
                });
            },
            join: function(data) {
                var room = data.room.replace('/','');
                this.join(room);
                this.rooms[room] = true;
                this.broadcast.to(room).emit('chat:join', {
                    name: this.user.name
                });

            },
            leave: function(data) {
                var room = data.room.replace('/','');
                this.leave(data.room);
                delete this.rooms[room];
                this.broadcast.to(room).emit('chat:leave', {
                    name: this.user.name
                });
            }
        }
    }
};

ExtendedSocketProto.setup = function() {
    this.enabledClasses = [];
    this.$events = [];
}

ExtendedSocketProto.enableEventClass = function(cls) {
    var events = this.classEvents[cls];
    for (var ns in events) {
        for (var ev in events[ns]) {
            var ev_name = ns + ':' + ev;
            this.$events[ev_name] = events[ns][ev];
        }
    }
    this.enabledClasses[cls] = true;
}

ExtendedSocketProto.disableEventClass = function(cls) {
    var events = this.classEvents[cls];
    for (var ns in events) {
        for (var ev in events[ns]) {
            var ev_name = ns + ':' + ev;
            delete this.$events[ev_name];
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
    socket.emit('init', {});

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