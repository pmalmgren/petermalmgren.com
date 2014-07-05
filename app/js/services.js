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

	// contains all the static information about the blog, last time updated, number of posts, 
	// and anything else I think of in the future
	app.factory('blogMetaAPI', function($http) {
		var blogMetaAPI = {};

		blogMetaAPI.getMetaData = function() {
			return $http.get('/app/api/index.json');
		}

		return blogMetaAPI;
	});

})();