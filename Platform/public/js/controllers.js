'use strict';

/* Controllers */

// console.log('route', $route);
// console.log('scope', $scope);
// console.log('location', $location);



var Controllers = {};

Controllers.main = function main($scope, $route, $location) {

	$scope.$route = $route;

}

Controllers.games = function games($scope, Games) {

	$scope.gamesgroup = Games.query();

}

Controllers.userProfile = function userProfile($scope, $http, $location) {

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