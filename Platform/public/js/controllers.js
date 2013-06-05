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
    });

    $scope.login = function () {
       console.log($scope.user);
       socket.emit('user:auth', $scope.user);
    }

    $scope.reset = function () {
        $location.path('/reset_password');
    }

}


Controllers.chat = function chat($scope, $rootScope, socket) {

    var username = $rootScope.userInfo.username;
    $scope.messages = [];
    $scope.users = [];

    socket.emit('chat:join', 'lobby');

    $scope.sendMessage = function () {
        $scope.messages.push({
            user: username,
            text: $scope.message,
            room: 'lobby'
        });

        socket.emit('chat:message', {
            text: $scope.message,
            room: 'lobby'
        });

        $scope.message = '';
    };

    socket.on('chat:message', function (message) {
        console.log(message);
        $scope.messages.push(message);
    });

    socket.on('chat:clients', function(data) {
        console.log(data);
        $scope.users = data.clients;
    });

    socket.on('chat:join', function (data) {
        $scope.messages.push({
            user: 'chatroom',
            text: 'User ' + data.name + ' has joined ' + data.room
        });
        if ($scope.users[data.name] == undefined)
            $scope.users[data.name] = 1;
        else
            $scope.users[data.name]++;
        //$scope.users.push(data.name);
    });

    // add a message to the conversation when a user disconnects or leaves the room
    socket.on('chat:leave', function (data) {
//        for (var i in $scope.users) {
//            var user = $scope.users[i];
//            if (user === data.name) {
//                $scope.users.splice(i, 1);
//                break;
//            }
//        }
        $scope.users[data.name]--;
        if (!$scope.users[data.name])
            delete $scope.users[data.name];


        $scope.messages.push({
            user: 'chatroom',
            text: 'User ' + data.name + ' has left ' + data.room
        });
    });
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


