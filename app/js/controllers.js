'use strict';

/* Controllers */

(function() {
	var app = angular.module('myApp.controllers', []);
	
	app.controller('PostsController', ['$scope', 'blogAPI', function($scope, blogAPI) {
		$scope.posts = [];
		
		blogAPI.getPosts().then(function (result) {
			$scope.posts = result;
		});
	}]);

})();
