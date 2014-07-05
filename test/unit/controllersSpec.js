'use strict';

/* jasmine specs for controllers go here */

describe('controllers', function(){
  beforeEach(module('myApp.controllers'));


  it('should initialize', inject(function($controller) {
    //spec body
    var myCtrl1 = $controller('PostsController', { $scope: {} });
    expect(myCtrl1).toBeDefined();
  }));

});
