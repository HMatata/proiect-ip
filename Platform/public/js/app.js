/*
 *  Angular app module
 */

'use strict';



var app = angular.module('WebAppModule', ['LocalStorageModule']);
app.config( function($routeProvider) {
	$routeProvider.
		when('/home', { redirectTo: '/games'}).
		when('/games', { templateUrl: 'partials/games.html', controller: Controllers.games}).
		when('/games/:gameId', { templateUrl: 'partials/game-page.html', controller: Controllers.gameInstance}).
		when('/profile', { templateUrl: 'partials/profile.html', controller: Controllers.userProfile}).
        when('/signup', {templateUrl: 'partials/signup.html', controller: Controllers.signup}).
        when('/login', { templateUrl: 'partials/login.html', controller: Controllers.login}).
        when('/chat:roomId', { templateUrl: 'partials/chat.html', controller: Controllers.chat}).
        when('/verify_email/:id', {templateUrl: 'partials/verify.html', controller: Controllers.verify}).
        when('/reset_password', {templateUrl: 'partials/reset_password.html', controller: Controllers.reset_password}).
		otherwise({ redirectTo: '/home'});
});


app.directive('btab', function($timeout) {
    return {
        link: function(scope, elm) {
            $timeout(function() {
//                console.log("Scope", scope);
//                console.log("Elm", elm)
//                console.log("Args", arguments);
//                console.log("Fst", elm.children());
                elm.children().tab('show');
            });
        }
    }
});

/*
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
*/
