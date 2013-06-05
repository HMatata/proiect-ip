'use strict';

/* Controllers */

// console.log('route', $route);
// console.log('scope', $scope);
// console.log('location', $location);



var Controllers = {};

Controllers.main = function main($scope, $rootScope, $route, $location, socket, localStore) {

    console.log(localStore);

    $rootScope.ssid = localStore.getRaw('ssid');
    $rootScope.userInfo = localStore.get('user');

    localStore.watch('ssid', function(event) {
        console.log(event);
    });

    localStore.watch('user', function(event) {
        console.log(event.key);
    });

    $scope.username = "Guest";
    $scope.logout = "Login";


    socket.on('session:info', function(data) {

        console.log("Got session info");
        console.log(data);

        var ssid = data.ssid;
        if (ssid) {
            if (ssid != $rootScope.ssid) {
                console.log("Session expired. New ssid = " + ssid);
                $rootScope.ssid = ssid;
                localStore.addRaw('ssid', ssid);
            }
        }
        var info = data.info;
        if (info) {
            $rootScope.userInfo = info;
            localStore.add('user', info);

            $scope.username = info.username;
            $scope.logout = "Logout";
        }
    });

    socket.emit('session:identify', $rootScope.ssid);
}

Controllers.games = function games($scope, socket) {

    socket.emit('games:list', {});
    socket.on('games:list', function (data) {
    	console.log("Game list", data);
        $scope.gamesgroup = data;
    });

}

Controllers.userProfile = function userProfile($scope, $rootScope, $http, $location, localStore, socket) {

    var userInfo = localStore.get('user');
    if (!userInfo)
        $location.path("/login");

    $scope.user = {};
    angular.copy(userInfo, $scope.user);
    console.log("Scope user object:", $scope.user);

	$scope.save = function() {
		socket.emit('user:update', $scope.user);
        //localStore.remove('user');
        localStore.add('user', $scope.user);
		$location.path('/home');
	};
}

Controllers.gameInstance = function gameInstance($scope, $location, socket, $routeParams) {

    socket.emit('games:gameId', $routeParams.gameId);
    socket.on('games:gameId', function (data) {
        $scope.game = data;
    });
}


Controllers.signup = function signup($scope, $location, socket) {

    socket.on('user:signup', function (data) {
        if (data.msg == 'ok')
            $location.path('/login');
        //TODO: Show appropiate message if signup data is incorrect

    });
    $scope.signup = function () {
        console.log($scope.user);
        socket.emit('user:add', $scope.user);
    };
}

Controllers.login = function login($scope, $location, socket, localStore) {

    localStore.remove('user');
    $scope.alert = "Input your username and password";
    $scope.user = {
        username: "",
        password: ""
    };
    $scope.$emit('userdata');

    socket.on('session:error', function (data){
        console.log("Error:", data.msg);
        //TODO: Print a nice message
    	var x = document.getElementById("login_status");
    	x.className  = "alert alert-error";
        $scope.alert = "Username or password we're wrong."

    });

    $scope.login = function () {
       console.log($scope.user);
       socket.emit('user:auth', $scope.user);
    }

    $scope.reset = function () {
        $location.path('/reset_password');
    }
}


var ChatRoom = function(name) {
    this.name = name;
    this.messages = [];
    this.users = {};
    this.socket.emit('chat:join', name);
};

ChatRoom.prototype = {
    focus: function() {
        //console.log(this);
        //console.log('Focused ' + this.name);
        this.scope.focusedRoom = this;
    },

    sendMessage: function(message) {
        this.messages.push({
            user: this.username,
            text: message,
            room: this.name
        });

        this.socket.emit('chat:message', {
            text: message,
            room: this.name
        });
    },

    showMessage: function(message) {
        this.messages.push(message);
    },

    setClients: function(clients) {
        this.clients = clients;
    },

    clientLeave: function(name) {
        this.users[name]--;
        if (!this.users[name])
            delete this.users[name];

        this.messages.push({
            user: 'chatroom',
            text: 'User ' + name + ' has left'
        });
    },

    clientJoin: function(name) {
        this.messages.push({
            user: 'chatroom',
            text: 'User ' + name + ' has joined'
        });
        if (this.users[name] == undefined)
            this.users[name] = 1;
        else
            this.users[name]++;
    },

    leave: function() {
        this.socket.emit('chat:leave', this.name);
        delete this.scope.rooms[this.name];
    }
}


Controllers.chat = function chat($scope, $rootScope, socket) {

    ChatRoom.prototype.username = $rootScope.userInfo.username;
    ChatRoom.prototype.socket = socket;
    ChatRoom.prototype.scope = $scope;

    $scope.rooms = {};

    var joinRoom = function(name) {
        var room = new ChatRoom(name);
        $scope.rooms[name] = room;
        $scope.focusedRoom = room;
        console.log($scope.rooms[name]);
    }

    $scope.joinRoom = function() {
        var name = $scope.newRoomName;
        joinRoom(name);
    };

    $scope.sendMessage = function () {
        $scope.focusedRoom.sendMessage($scope.message);
        $scope.message = '';
    };

    socket.on('chat:message', function (message) {
        console.log(message);
        $scope.rooms[message.room].showMessage(message);
    });

    socket.on('chat:clients', function(data) {
        console.log(data);
        $scope.rooms[data.room].setClients(data.clients);
    });

    socket.on('chat:join', function (data) {
        $scope.rooms[data.room].clientJoin(data.name);
    });

    socket.on('chat:leave', function (data) {
        $scope.rooms[data.room].clientLeave(data.name);
    });

    $scope.$on('$destroy', function() {
        console.log("Chat was destroyed");
        for (var room in $scope.rooms) {
            $scope.rooms[room].leave();
        }

        var chatEvents = [];
        var allEvents = socket.raw.$events;
        console.log("Events ");
        console.log(allEvents);
        for (var event in allEvents) {
            if (event.indexOf('chat:') == 0) {
                chatEvents.push(event);
            }
        }
        console.log("Removing " + chatEvents);

        //TODO: Does not actually delete the events. Must check out why
        //TODO: Find out why does the chat:clients event still propagate from the server after leaving the room
        for (var event in chatEvents) {
            delete socket.raw.$events[event];
        }
        console.log(socket.raw.$events);

    });

    joinRoom('lobby');
}

Controllers.verify = function verify($scope, $location, socket, $routeParams) {
    socket.emit('user:verify', $routeParams.id);
    socket.on('user:verify', function (data) {
        //TODO: maybe print something here
        $location.path('/login');
    });
}

Controllers.reset_password = function reset_password($scope, $location, socket) {
    socket.on('user:reset_password', function (data) {
        console.log(data);
        $location.path('/login')
    });
    $scope.reset = function()  {
        console.log("resetting a password");
        socket.emit('user:reset_password', $scope.email);
    }
}

Controllers.feedback = function feedback($scope, socket) {
    $scope.send = function () {
        socket.emit('user:feedback', $scope.feedback);
        console.log($scope);
    }
}


