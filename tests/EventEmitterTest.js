var Zone = require('../lib/Setup.js').enable();

exports.emitterInRootZone = function(test){
  var EventEmitter = require('events').EventEmitter;
  var radium = new EventEmitter();

  test.expect(2);
  setTimeout(function() {
    test.ok(true);
    radium.emit('radiation', 'GAMMA');
  }, 1000);

  radium.on('radiation', function(ray) {
    test.equal(ray, 'GAMMA');
    test.done();
  });
}

exports.emitterCrossZone1 = function(test){
  var EventEmitter = require('events').EventEmitter;
  var radium = new EventEmitter();
  test.expect(2);
  
  var ChildZone = function ChildZone(test, radium){
    setTimeout(function() {
      test.ok(true);
      radium.emit('radiation', 'GAMMA');
    }, 1000);
    
    radium.once('radiation', function(ray) {
      test.equal(ray, 'GAMMA');
    });
  };
  
  var doneCB = function(){
    test.done();
  }
  
  c = zone.define(ChildZone, doneCB);
  c(test, radium);
}

exports.emitterCrossZone2 = function(test){
  var EventEmitter = require('events').EventEmitter;
  var radium = new EventEmitter();
  test.expect(2);
  
  var ChildZone = function ChildZone(test, radium){
    radium.once('radiation', function(ray) {
      test.equal(ray, 'GAMMA');
    });
  };
  
  var doneCB = function(){
    test.done();
  }
  
  c = zone.define(ChildZone, doneCB);
  c(test, radium);
  
  setTimeout(function() {
    test.ok(true);
    radium.emit('radiation', 'GAMMA');
  }, 1000);
}

exports.testAddRemoveListener = function(test){
  var EventEmitter = require('events').EventEmitter;
  var radium = new EventEmitter();
  var listener = function(data){
    test.ok(true);
  }
  var done = function(data){
    test.done();
  }

  test.expect(1);
  radium.on('radiation', listener);
  radium.once('done', done);  
  radium.emit('radiation', 'GAMMA');
  radium.removeListener('radiation', listener);
  radium.emit('radiation', 'GAMMA');
  radium.emit('done', 'done');  
}

exports.testEmitOnce = function(test){
  var EventEmitter = require('events').EventEmitter;
  var radium = new EventEmitter();
  var listener = function(data){
    test.ok(true);
  }
  var done = function(data){
    test.done();
  }
  
  test.expect(1);  
  radium.once('radiation', listener);
  radium.once('done', done);  
  radium.emit('radiation', 'GAMMA');
  radium.emit('radiation', 'GAMMA');
  radium.emit('done', 'done');  
}