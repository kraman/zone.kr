var Zone = require('../lib/Setup.js').enable();

var assert = require('assert');
var Zone = zone.Zone;

// Test primary callback with result.
exports.testErrbackWithResult = function(test) {
  zone.create(function() {
    zone.return (42);
  }).setCallback(function(err, a, b) {
    test.strictEqual(err, null);
    test.strictEqual(a, 42);
    test.strictEqual(b, undefined);
    test.done();
  });
}

// Test primary callback with error.
exports.testErrbackWithError = function(test) {
  zone.create(function() {
    zone.return (42);
    throw new Error();
  }).setCallback(function(err, a, b) {
    test.ok(err instanceof Error);
    test.equal(a, undefined);
    test.equal(b, undefined);
    test.done();
  });
}

// Test catch callback.
exports.testCatchBlock = function(test) {
  zone.create(function() {
    zone.throw(new Error());
  }).catch (function(err) {
    test.ok(err instanceof Error);
    test.done();
  });
}

exports.testThenWithError = function(test){
  zone.create(function() {
    throw new Error();
  }).then(function onSuccess() {
    test.ok('false');
  }, function onError(err) {
    test.ok(err instanceof Error);
    test.done();
  });
}

exports.testThenWithSuccess = function(test){
  zone.create(function() {
   this.return(1, 2, 3);
  }).then(function onSuccess(a, b, c) {
    test.strictEqual(a,1);
    test.strictEqual(b,2);
    test.strictEqual(c,3);
    test.done();
  }, function onError(err) {
    test.ok(false);
  });
}

exports.testCompleteMethod = function(test){
  zone.create(function() {
    zone.complete(null, 42);
  }).setCallback(function(err, value) {
    test.strictEqual(value, 42);
    test.done();
  });
}

exports.testThrowingNonError = function(test){
  zone.create(function() {
    throw 133;
  }).catch (function(err) {
    test.ok(err instanceof Error);
    test.strictEqual(err.value, 133);
    test.done();
  });  
}

exports.testAutoExit = function(test){
  zone.create(function() {
    //no-op
  }).setCallback(function(err) {
    test.strictEqual(err, null);
    test.strictEqual(arguments.length, 1);
    test.done();
  });
}