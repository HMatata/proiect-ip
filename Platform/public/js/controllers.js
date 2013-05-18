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

Controllers.login = function login($scope, socket) {
    socket.on('user:identify', function (data){
        console.log("Identified as:", data);
        //TODO: Store the data in the local storage
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

