'use strict';

/* Controllers */

// console.log('route', $route);
// console.log('scope', $scope);
// console.log('location', $location);



var Controllers = {};

Controllers.main = function main($scope, $route, $location) {
    console.log()
	$scope.$route = $route;

}

Controllers.games = function games($scope, socket, Games) {

    console.log("games called", $scope.gamesgroup);
    socket.on('init', function () {
        console.log("merge");

    });

    $scope.gamesgroup = Games.query();
    /*
    socket.on('games:list', function (data) {

        $scope.gamesgroup = data;

    });
      */


}

Controllers.userProfile = function userProfile($scope, $http, $location, socket) {


	/*
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
	*/
}

Controllers.gameInstance = function gameInstance($scope, $location) {
}
