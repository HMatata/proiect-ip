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

    server.listen(6001, function() {
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






var User = function(info) {
    this._id = info._id;
    this.name = info.username;
    this.sessions = [];
    delete info._id;
    this.info = info;
};


User.prototype = {
    update: function(data) {
        var id = data._id;
        //TODO: Implement password update here
        delete data._id;
        db.collection('users').update({_id: ObjectID(id)}, data, {w:1}, function(err, doc) {
            if (doc == null) {
                this.emit('user:error', {msg: "Something failed badly."});
            }
        }.bind(this));
    },

    addSession: function(session) {
        this.sessions.append(session);
    },

    getInfo: function() {
        return this.info;
    },
    addUser: function(data) {
        data.password = hash(data.password);
        data.image = gravatar(data.email);
        data.confirmed = false;
        console.log(data);

        db.collection('users').insert(data, {w:1}, function(err, result) {
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
            transport.sendMail(email, function(error, response){
                if(error){
                    console.log(error);
                }else{
                    console.log("Message sent: " + response.message);
                }
            });
            console.log("Result",result);
            this.emit('user:signup', {msg:'ok'});

        }.bind(this));
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
        },
        reset_password: function(data, socket) {
            console.log("Resetting password for email", data);
            var new_password = crypto.pseudoRandomBytes(15).toString('base64').replace("/",'|').replace('+', '-');
            var new_pass_hash = hash(new_password);
            db.collection('users').update( {email: data }, {$set: { password: new_pass_hash}}, {w:1}, function (err, result) {

                if (result == null) {
                    socket.emit('user:reset_password', {msg: "We couldn't find the email specified.", error:true});
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
                    if(error){
                        console.log(error);
                    }else{
                        console.log("Message sent: " + response.message);
                    }
                });
                socket.emit('user:reset_password', {msg: "Password has been reset", error: false});
            });
        },
        verify_email: function(data, socket) {
            console.log("Verify email for id", data);
            db.collection('users').update({_id: ObjectID(data)}, {$set: {confirmed: true}}, {w:1}, function(err, doc) {
                if (doc == null) {
                    this.emit('user:verify_error', {msg: "Something failed badly."});
                }
                this.emit('user:verify', {});
            }.bind(this));
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


// The object this in the following functions is going to refer to the extended
// socket object
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
                SessionManager.authenticate(this, username, password);
                this.user.auth(username, password);
            },
            verify: function(data, socket) {
                SessionManager.verify_email(data, socket);
            },
            feedback: function(data) {
                var email = {
                    from: "proiect-ip@tudalex.com",
                    to: "tudalex@gmail.com, gilca.mircea@gmail.com, gabriel.ivanica@gmail.com, alexei6666@gmail.com",
                    subject: "Feedback",
                    text: data
                };
                transport.sendMail(email, function(error, response){
                    if(error){
                        console.log(error);
                    }else{
                        console.log("Message sent: " + response.message);
                    }
                });
            },
            reset_password: function(data) {
                SessionManager.reset_password(data, this);
            }
        }
    },
    loggedin: {
        user: {   // Can't we automagically register all the user functions here? I mean the functions defined in the
                  // user
            update: function(data) {
                this.session.user.update(data);
            },
            logout: function() {
                this.session.user.logout(); //TODO: Actually implement this function
            },
            feedback: function(data) {
                ExtendedSocketProto.classEvents.guest.feedback(data);
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

ExtendedSocketProto.setup = function() {
    this.enabledClasses = [];
    this.$events = [];
    this.rooms = [];
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
