'use strict';

/* Controllers */

(function() {
	var app = angular.module('myApp.controllers', []);

	app.controller('PostsController', function($scope, blogAPI) {
		$scope.posts = [];
		
		blogAPI.getPosts().success(function (result) {
			$scope.posts = result;
			console.log(result);
		});
	});

})();
