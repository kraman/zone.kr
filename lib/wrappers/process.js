// TODO:
//   * The process object is an EventEmitter. Make it hebave properly in the
//     context of zones.
//   * `process.on('SIGxxx', cb)` implicitly constructs a signal watcher -
//      decide what to do with that (add to the root zone and unref?)
//   * Investigate what the zone implications are for
//     - cluster messaging: `process.on('message')`

//netxTick callbacks are self contained and can be cleaned up automatically
//var realNextTick = process.nextTick;
process.nextTick = function(cb){
  global.zone.runNextTick(cb);
}

// process.stdin/stdout/stderr
var realStdinGetter = Object.getOwnPropertyDescriptor(process, 'stdin').get;
var realStdoutGetter = Object.getOwnPropertyDescriptor(process, 'stdout').get;
var realStderrGetter = Object.getOwnPropertyDescriptor(process, 'stderr').get;

assert.strictEqual(typeof realStdinGetter, 'function');
assert.strictEqual(typeof realStdoutGetter, 'function');
assert.strictEqual(typeof realStderrGetter, 'function');

var stdinGetter = zone.root.bind(null, realStdinGetter, false);
var stdoutGetter = zone.root.bind(null, realStdoutGetter, false);
var stderrGetter = zone.root.bind(null, realStderrGetter, false);

Object.defineProperties(process, {
  stdin: { get: stdinGetter, configurable: true },
  stdout: { get: stdoutGetter, configurable: true },
  stderr: { get: stderrGetter, configurable: true }
});