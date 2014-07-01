'use strict';

/* Services */

(function() {
	var app = angular.module('myApp.services', []);

	app.factory('blogAPI', function($http) {
		var blogAPI = {};

		blogAPI.getPosts = function() {
			return $http.get('/app/api/posts.json');
		}

		return blogAPI;
	});

})();