/*
 *  Angular app module
 */

'use strict';

angular.module('WebAppModule', ['gameService']).config( function($routeProvider) {
	$routeProvider.
		when('/home', { redirectTo: '/games'}).
		when('/games', { templateUrl: 'partials/games.html', controller: Controllers.games}).
		when('/games/:gameId', { templateUrl: 'partials/game-page.html', controller: Controllers.gameInstance}).
		when('/profile', { templateUrl: 'partials/profile.html', controller: Controllers.userProfile}).
		otherwise({ redirectTo: '/home'});
});


angular.module('gameService', ['ngResource']).factory('Games', function($resource) {
	return $resource('games/:gameId.json', {}, {
		query: {
			method: 'GET',
			params: {
				gameId:'games'
			},
			isArray: true
		}
	});
});
