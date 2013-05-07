/*
 *  Angular app module
 */

'use strict';



var app = angular.module('WebAppModule', ['gameService']);
app.config( function($routeProvider) {
	$routeProvider.
		when('/home', { redirectTo: '/games'}).
		when('/games', { templateUrl: 'partials/games.html', controller: Controllers.games}).
		when('/games/:gameId', { templateUrl: 'partials/game-page.html', controller: Controllers.gameInstance}).
		when('/profile', { templateUrl: 'partials/profile.html', controller: Controllers.userProfile}).
		otherwise({ redirectTo: '/home'});
});


app.factory('socket', function ($rootScope) {
    var socket = io.connect();
    return {
        on: function (eventName, callback) {
            socket.on(eventName, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    callback.apply(socket, args);
                });
            });
        },
        emit: function (eventName, data, callback) {
            socket.emit(eventName, data, function () {
                var args = arguments;
                $rootScope.$apply(function () {
                    if (callback) {
                        callback.apply(socket, args);
                    }
                });
            })
        }
    };
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
