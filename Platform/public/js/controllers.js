'use strict';

/* Controllers */

// console.log('route', $route);
// console.log('scope', $scope);
// console.log('location', $location);



var Controllers = {};

Controllers.main = function main($scope, $route, $location, socket) {
    //if $scope.localsocket.emit('auth', )
	$scope.$route = $route;
    console.log("called the main controller");
}

Controllers.games = function games($scope, socket, Games) {

    console.log("games called", $scope.gamesgroup);
    socket.on('init', function () {
        console.log("merge");

    });

    $scope.gamesgroup = Games.query();
    socket.emit('games:list', {});
    socket.on('games:list', function (data) {

        $scope.gamesgroup = data;

    });



}

Controllers.userProfile = function userProfile($scope, $http, $location, socket) {


    $http.get('json/user.json').success(function(data) {
		$scope.user = data;
	});

	$scope.cancel = function() {
		$scope.form = angular.copy($scope.person);
	};

	$scope.save = function() {
		angular.copy($scope.form, $scope.person);
		$location.path('/home');
	};

	$scope.cancel();

}

Controllers.gameInstance = function gameInstance($scope, $location) {

}

Controllers.signup = function signup($scope, socket) {
    $scope.signup = function () {
      console.log($scope.user);
      socket.emit('user:add', $scope.user);
    };
}

Controllers.login = function login($scope, socket, localStorageService) {

    socket.on('user:identify', function (data){
        console.log("Identified as:", data);
        localStorageService.add('user',JSON.stringify(data));

        //TODO: This is how you should use it, don't forget JSON.parse
        console.log(JSON.parse(localStorageService.get('user')));
    });
    socket.on('user:error', function (data){
        console.log("Error:", data.msg);
        //TODO: Print a nice message
    });
    $scope.login = function () {
       console.log($scope.user);
       socket.emit('user:auth', $scope.user);


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

