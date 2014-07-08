'use strict';

/* jasmine specs for controllers go here */

describe('Blog post tests', function() {
  var posts = [{"title": "Test title 1","body": "Test body 1","date": "Test date 1"}, {"title": "Test title 2","body": "Test body 2","date": "Test date 2"}];

  beforeEach(module('myApp'));

  var scope, fakeAPI, controller, q, deferred;

  beforeEach(function() {
    fakeAPI = {
      getPosts: function() {
        deferred = q.defer();
        deferred.resolve(posts);
        return deferred.promise;
      }
    };
    spyOn(fakeAPI, 'getPosts').andCallThrough();
  });

  beforeEach(inject(function ($rootScope, $controller, $q) {
    q = $q;
  	scope = $rootScope.$new();
  	controller = $controller('PostsController', { $scope: scope, blogAPI: fakeAPI });
  }));

  it('posts should not be defined', function() {
    expect(scope.posts).not.toBe([]);
  });

  it('should be defined after the scope is initialized', function() {
    scope.$apply();
    expect(scope.posts).toBeDefined();
  });

  it('should call the factory method after initalization', function() {
    scope.$apply();
    expect(fakeAPI.getPosts).toHaveBeenCalled();
  });

  it('should have 2 posts', function() {
    scope.$apply();
    expect(scope.posts.length).toBe(2);
  });

});
