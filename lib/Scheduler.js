var assert = require('assert');
var LinkedList = require('./LinkedList.js');
var realNextTick = process.nextTick;

var callbackQueue = new LinkedList();
var zoneQueue = []
var scheduled = false;

function enqueueCallback(zone, receiver, fn, args) {
  callbackQueue.push([zone, receiver, fn, args]);
	zone.__increment_callback_count__();

  if (!scheduled) {
    scheduled = true;
    realNextTick(processQueues);
  }
}

function enqueueZone(zone) {
  zoneQueue.push(zone);

  if (!scheduled) {
    scheduled = true;
    realNextTick(processQueues);
  }
}

function dequeueZone(zone) {
  for(var i=0;i<zoneQueue.length;i++){
    if(zoneQueue[i] === zone){
      zoneQueue[i] = null;
    }
  }
}

function processCallbacks(){
  var callbackEntry;
  while (callbackEntry = callbackQueue.shift()) {
    var zone = callbackEntry[0];
    var receiver = callbackEntry[1];
    var fn = callbackEntry[2];
    var args = callbackEntry[3];

    var prevZone = global.zone;
    global.zone = null;
    zone.apply(receiver, fn, args);
    global.zone = prevZone;
    zone.__decrement_callback_count__();
    zone = null;
  }
}

function processZones(){
  var prevZone = global.zone;
  global.zone = null;
  var zoneEntry = zoneQueue.shift();
  if (zoneEntry){
    zoneEntry.__finalize__();
  }
  global.zone = prevZone;
}

function processQueues() {
  scheduled = false;
  var zoneEntry;
  var result;
  
  do {
    processCallbacks();
    processZones();
  } while (zoneQueue.length !== 0);
}



exports.enqueueCallback = enqueueCallback;
exports.enqueueZone = enqueueZone;
exports.dequeueZone = dequeueZone;
