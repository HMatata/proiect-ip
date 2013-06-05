'use strict';

/* Controllers */

// console.log('route', $route);
// console.log('scope', $scope);
// console.log('location', $location);



var Controllers = {};

Controllers.main = function main($scope, $rootScope, $route, $location, socket, localStorageService) {
    //if $scope.localsocket.emit('auth', )
	$scope.$route = $route;



    $rootScope.$on('userdata', function () {
        var user_info = JSON.parse(localStorageService.get('user'));
        console.log("Scope:", $scope);
        if (user_info != null) {
            $scope.username = user_info.username;
            $scope.logout = "Logout";
        } else {
            $scope.username = "Guest";
            $scope.logout = "Login";
        }
    });

    $scope.$emit('userdata');

}

Controllers.games = function games($scope, socket) {

    socket.emit('games:list', {});
    socket.on('games:list', function (data) {
    	console.log("Game list", data);
        $scope.gamesgroup = data;
    });

}

Controllers.userProfile = function userProfile($scope, $http, $location, localStorageService, socket) {

    var user = JSON.parse(localStorageService.get('user'));
    if (!user)
        $location.path("/login");
    $scope.user = {};
    angular.copy(user, $scope.user);
    console.log("Scope user object:",$scope.user);


	$scope.save = function() {

		socket.emit('user:update', $scope.user);
        localStorageService.remove('user');
        localStorageService.add('user', JSON.stringify($scope.user));
		$location.path('/home');
	};
}

Controllers.gameInstance = function gameInstance($scope, $location, socket, $routeParams) {

    socket.emit('games:gameId', $routeParams.gameId);
    socket.on('games:gameId', function (data) {
        $scope.game = data;
        $scope.game.width = 320;
        $scope.game.height = 440;

        console.log("Data", data);
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

Controllers.login = function login($scope, $location, socket, localStorageService) {

    localStorageService.remove('user');
    $scope.$emit('userdata');
    socket.on('user:identify', function (data){
        console.log("Identified as:", data);
        localStorageService.add('user',JSON.stringify(data));
        $scope.$emit('userdata');
        //TODO: This is how you should use it, don't forget JSON.parse
        console.log(JSON.parse(localStorageService.get('user')));
        $location.path('/home');
    });
    socket.on('user:error', function (data){
        console.log("Error:", data.msg);
        //TODO: Print a nice message
    });

    $scope.login = function () {
       console.log($scope.user);
       socket.emit('user:auth', $scope.user);
    }

    $scope.reset = function () {
        $location.path('/reset_password');
    }

}


Controllers.chat = function chat($scope, socket) {

    // Socket listeners
    // ================

    socket.on('init', function (data) {
        $scope.name = data.name;
        $scope.users = data.users;
    });

    socket.on('send:message', function (message) {
        console.log(message);
        $scope.messages.push(message);
    });

    socket.on('user:join', function (data) {
        $scope.messages.push({
            user: 'chatroom',
            text: 'User ' + data.name + ' has joined.'
        });
        $scope.users.push(data.name);
    });

    // add a message to the conversation when a user disconnects or leaves the room
    socket.on('user:left', function (data) {
        $scope.messages.push({
            user: 'chatroom',
            text: 'User ' + data.name + ' has left.'
        });
        var i, user;
        for (i = 0; i < $scope.users.length; i++) {
            user = $scope.users[i];
            if (user === data.name) {
                $scope.users.splice(i, 1);
                break;
            }
        }
    });

    $scope.messages = [];

    $scope.sendMessage = function () {
        socket.emit('send:message', {
            message: $scope.message
        });

        // add the message to our model locally
        $scope.messages.push({
            user: $scope.name,
            text: $scope.message
        });

        // clear message box
        $scope.message = '';
    };
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


