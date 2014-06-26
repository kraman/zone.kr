var Zone = require('../lib/Setup.js').enable();
var assert = require('assert');
var Zone = zone.Zone;

var exec = require('child_process').exec;
var execFile = require('child_process').execFile;
var spawn = require('child_process').spawn;

exports.dummy = function(test){
  test.done();
}

exports.testSpawnProcessZone = function(test) {
  test.expect(3);
  var spawnZone = zone.create(function SpawnZone() {
    setTimeout(function() {
      test.strictEqual(zone, spawnZone);
      throw new Error('expected error');
    });
    
    // function onClose(code, signal) {
    //   callbackCount++;
    //   test.strictEquals(zone, spawnZone);
    //   test.strictEquals(signal, 'SIGKILL');
    // }

    // var p = spawn('cat', ['-']);
    // p.on('close', onClose);
  }).catch (function(err) {
     test.strictEqual(zone, zone.root);
     test.ok(/expected/.test(err));
     test.done();
   });
}
//
//
//
// // var execZone = zone.create(function ExecZone() {
// //   exec('echo hello world', callback);
// //
// //   function callback(err, stdout, stderr) {
// //     callbackCount++;
// //     assert(zone === execZone);
// //     assert(!err);
// //     assert(/hello world/.test(stdout));
// //   }
// // });
// //
// //
// // var execFileZone = zone.create(function ExecFileZone() {
// //   execFile('inv$alid~file', [], callback);
// //
// //   function callback(err, stdout, stderr) {
// //     callbackCount++;
// //     assert(zone === execFileZone);
// //     throw err;
// //   }
// //
// // }).catch (function(err) {
// //   callbackCount++;
// //   assert(err.code === 'ENOENT');
// // });
// //
// //
