EventEmitter = require('events').EventEmitter;
util = require('util');
EventEmitter.usingDomains = false;
EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;
EventEmitter.prototype._zone = undefined;
EventEmitter.prototype._crossZone = false;
EventEmitter.prototype._zoneListeners = {};

/**
 * Initialize the event emitter and allow cross zone invocations.
 * @private
 */
var realEventEmitterInit = EventEmitter.init;
EventEmitter.init = function init() {
  this._zone = zone;
  this._crossZone = true;
  this._zoneListeners = {}; //keeps a map of zone -> wrappedListener
  return realEventEmitterInit.apply(this, arguments);
}

/**
 * Perform zone check and emit events
 * @private
 */
var realEventEmitterEmit = EventEmitter.prototype.emit;
EventEmitter.prototype.emit = function emit() {
  zoneCheck(this);
  return this._zone.apply(this, realEventEmitterEmit, arguments);
}

/**
 * Bind the listener to the current zone and register it with the event emitter
 * @private
 */
var realEventEmitterAddListener = EventEmitter.prototype.addListener;
var addListener = function(event, listener) {
  zoneCheck(this);
  listener = wrapListener(this, event, listener)
  return realEventEmitterAddListener.call(this, event, listener);
}
EventEmitter.prototype.addListener = addListener;
EventEmitter.prototype.on = EventEmitter.prototype.addListener;

var realEventEmitterRemoveListener = EventEmitter.prototype.removeListener;
EventEmitter.prototype.removeListener = function(event, listener) {
  zoneCheck(this);
  wrappedListenerFunc = findListener(this, event, listener);
  if(wrappedListenerFunc){
    var result = realEventEmitterRemoveListener.call(this, event, wrappedListenerFunc);
    releaseListener(wrappedListenerFunc);
  }
  return
}

var realEventEmitterListeners = EventEmitter.prototype.listeners;
EventEmitter.prototype.listeners = function(event) {
  var events = this._events;
  var list = events[key];
  if (util.isFunction(list)) {
    return list._listener;
  } else if(list){
    var result = [];
    for (var i = 0; i < list.length; i++) {
      result.push(list[i]._listener);
    }
    return result;
  }else{
    return null;
  }
}

var listenerId = 0;
function wrapListener(emitter, event, listener) {
  //maintain a list of zone->listeners association so we can clean them
  //up if we recieve a signal later
  if (!emitter._zoneListeners[zone.id]) {
    emitter._zoneListeners[zone.id] = {};
  }

  //Id allows us to easily identify the currosponding wrapped listener
  listener._zone = zone;

  //during cleanup, will need a handle to the emitter so we can psuh
  //remaining events
  wrappedListenerFunc = zone.bind(null, listener, false);
  wrappedListenerFunc._emitter = emitter;
  wrappedListenerFunc._event = event;
  wrappedListenerFunc._listener = listener;
  wrappedListenerFunc._id = ++listenerId;

  wrappedListenerFunc.signal = function(){
    removeAllZoneListeners(emitter, zone);
  }
  emitter._zoneListeners[zone.id][wrappedListenerFunc._id] = wrappedListenerFunc;

  return wrappedListenerFunc;
}

/**
 * Given an event and user provided (unwrapped) listener, find the wrapped
 * listener associated with it.
 * @private
 */
function findListener(emitter, event, listener){
  var events = emitter._events;
  var list = events[event];
  if (util.isFunction(list)) {
    if(list._listener === listener){
      return list;
    }else{
      return null;
    }
  } else if (list){
    for (var i = 0; i < list.length; i++) {
      if(list[i]._listener === listener){
        return list[i];
      }
    }
  }
  return null;
}

/**
 * Cleanup references to a single listener
 * @private
 */
function releaseListener(wrapListener) {
  var emitter = wrapListener._emitter;
  var originalListener = wrapListener._listener;
  
  //cleanup listeners
  wrapListener.release();
  if(emitter._zoneListeners[originalListener._zone.id]){
    delete emitter._zoneListeners[originalListener._zone.id][wrapListener._id];
    if (Object.keys(emitter._zoneListeners[originalListener._zone.id]).length === 0) {
      delete emitter._zoneListeners[originalListener._zone.id];
    }
  }
}

/**
 * Given a zone, find all listeners associated with that zone and remove them
 * This is used to clean up all listeners when once of the listeners is 
 * signaled to exit
 * @private
 */
function removeAllZoneListeners(emitter, zone) {
  list = emitter._zoneListeners[zone.id];
  while(l && l.length > 0){
    var wrappedListenerFunc = list.pop();
    var result = realEventEmitterRemoveListener.call(emitter, wrappedListenerFunc._event, wrappedListenerFunc);
    releaseListener(wrappedListenerFunc);
  }
}

/**
 * Ensure that emitter zone is initialized properly
 * @private
 */
function zoneCheck(emitter) {
  if (emitter._zone && emitter._crossZone) {
    // Normal case: this EventEmitter was initialized in the constructor, hence
    // can be used across multiple zones. Check if the active zone is the same
    // or a child zone of the constructor zone.
    if (zone !== emitter._zone && !zone.childOf(emitter._zone))
      throw new Error('Only the zone in which the event emitter was creates ' +
        "and it's child zone can interact with this EventEmitter.");

  } else if (emitter._zone && !emitter._crossZone) {
    // Compatibility: sometimes libraries inherit from EventEmitter but they
    // omit calling the EventEmitter constructor from the subclass constructor.
    // In these cases we can't capture the construction zone so we disallow
    // using the EventEmitter across zones.
    if (zone !== emitter._zone)
      throw new Error('Only one zone can interact with this EventEmitter but' +
        " you're not in it. You can win more freedom by " +
        'calling the EventEmitter() constructor properly.');

  } else {
    // See the previous case. This EventEmitter is used for the first time, so
    // lazily capture the zone but clear the _crossZone flag.
    emitter._zone = zone;
  }
}
