'use strict';

/* Directives */

(function() {
	var app = angular.module('myApp.directives', []);

	app.directive('navBar', function() {
	    return {
	    	restrict: 'E',
	    	templateUrl: 'nav.html'
	    };
	});

	app.directive('blogPost', function() {
		return {
			restrict: 'E',
			templateUrl: 'blog.html'
		};
	});

	app.directive('articles', function() {
		return {
			restrict: 'E',
			templateUrl: 'blog.html'
		};
	});

})();