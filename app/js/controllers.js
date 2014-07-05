'use strict';

/* Controllers */

(function() {
	var app = angular.module('myApp.controllers', []);
	
	app.controller('PostsController', function($scope, blogAPI) {
		$scope.posts = [];
		
		blogAPI.getPosts().success(function (result) {
			$scope.numPages = Math.floor(result.length / 5);
			$scope.posts = result;

			for (var i = result.length - 1; i >= 0; i--) {
				
			};
		});
	});

})();
