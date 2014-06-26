assert = require('assert');
uid = require('./Uid.js');
scheduler = require('./Scheduler.js');
NonError = require('./NonError.js');
ZoneDelegate = require('./ZoneDelegate.js')

function zonePrepareStackTrace(_, stack){ return stack; };


/**
 * @class
 * @private
 */

function Zone(functionBody, options, callback) {
  // assert(typeof functionBody === 'function' || (options && options.isConstructingRootZone))

  /**
   * This function is called first when an error is encountered.
   * Callback registered using constructor or setCallback().
   * @private
   */
  this.errorFirstCallback = callback;

  /**
   * This function is called upon returning from the zone succesfully.
   * Callback registered using zone.then(...)
   * @private
   */
  this.successCallback = null;

  /**
   * This function is called upon returning from the zone with an error
   * provided no errorFirstCallback is set. Callback registered using
   * zone.then(...)
   * @private
   */
  this.errorCallback = null;

  /**
   * True if this is the root zone.
   * @private
   */
  this.isRoot = false;

  var name;
  if (options.isConstructingRootZone) {
    name = 'Root';
    this.isRoot = true;
  } else if (options.name) {
    name = options.name;
  } else if (functionBody.name) {
    name = functionBody.name;
  } else {
    name = 'Anonymous';
  }

  /**
   * Zone name
   */
  this.name = name;

  // Ensure that this is a new Zone instance and not called as function.
  // Simple instanceof checks don't work, because we want to detect when Zone
  // is called as a method of a zone:
  //    zone.Zone(...)
  // which fools the instance check, because the receiver is an instance of
  // Zone, but not a new zone. For new zones, its an instanceof Zone AND it 
  // does not yet have it's own 'id' property.
  // assert( (this instanceof Zone) && !this.hasOwnProperty('id'))

  /**
   * Zone ID (unique)
   */
  this.id = uid();

  if (this.isRoot) {
    this.parent = null;
    this.root = this;
  } else {
    //assert(zone);
    this.parent = zone;
    this.root = zone.root;
  }

  /**
   * Number of children which are delegates
   * @type {number}
   * @private
   */
  this.numDelegates = 0;

  /**
   * Number of callbacks scheduled to execute against this zone
   * @type {number}
   * @private
   */
  this.numOutstandingCallbacks = 0;

  /**
   * A pointer to the previous sibling zone or delegate within the parent zone
   * @private
   */
  this.__previous_sibling__ = null;

  /**
   * A pointer to the next sibling zone or delegate within the parent zone
   * @private
   */
  this.__next_sibling__ = null;

  /**
   * The most recently signaled zone
   * @private
   */
  this.__last_signaled_child__ = null;

  /**
   * The most recently added (currently active) child zone or delegate.
   * @private
   */
  this.__last_child__ = null;

  /**
   * If true then the zone has been scheduled for cleanup.
   * @private
   */
  this.finalizerScheduled = false;

  /**
   * Set after finalizer has completed running
   * @private
   */
  this.closed = false;

  /**
   * Stores an error that is caused in this zone or propogated from parent or
   * child.
   * @private
   */
  this.error = null;

  /**
   * Stores the result value for this zone.
   * @private
   */
  this.result = undefined;

  /**
   * The HTTP agent and the HTTP client are so intertwined that it is not
   * practical to share them between zones. See wrappers/node-lib/_http_agent.js
   * @private
   */
  this.__http_agent__ = null;

  if (!this.isRoot) {
    this.parent.__register__(this);
    this.run(functionBody);
    this.enqueueFinalize();
  }
  
  if(Error.stackTraceLimit > 0){
    Error.captureStackTrace(this, Zone);
  }
}

Zone.prototype.data = {};

/**
 * @callback ZoneCallback
 * @param {error} error On error, contains the error object. Null if zone
 * exited succesfully
 * @param {*} arguments One of more arguments returned from within the zone
 */

/**
 * Creates a one-off Zone in which the function body is run.
 *
 * @param {function} functionBody The function to be wrapped and run within the Zone.
 * @options {object} [Options]
 * @prop {string} [name] The name of the zone. Defaults to name of wrapped function.
 * @end
 * @param {ZoneCallback} [callback] Callback which is called with
 * errors or results when the zone exits
 * @return {Zone} Zone
 */
Zone.prototype.create = function create(functionBody, options, callback) {
  var params = _parseZoneOptions(options, callback);
  var z = new Zone(functionBody, params[0], params[1]);
  return z;
}

/**
 * Utility method to create a reusable function which will run within a new Zone.
 *
 * @param {function} functionBody The function to be wrapped and run within the Zone.
 * @options {object} [Options]
 * @prop {string} [name] The name of the zone. Defaults to name of wrapped function.
 * @end
 * @param {Zone~primaryCallback} [callback] Callback which is called with
 * errors or results when the zone exits
 * @return {Zone} Zone
 */
Zone.prototype.define = function define(functionBody, options, callback) {
  var params = _parseZoneOptions(options, callback);
  var functionName = functionBody.name;
  if (!params[0] || !params[0].hasOwnProperty('name')) {
    params[0].name = functionName;
  }

  return function() {
    var args = arguments;

    function wrappedBody() {
      return functionBody.apply(this, args);
    }

    var z = new Zone(wrappedBody, params[0], params[1]);
    return z;
  }
}

Zone.prototype.childOf = function childOf(checkParent) {
  z = this;
  do {
    if (z === checkParent) {
      return true;
    } else {
      z = z.parent;
    }
  } while (z)
  return false;
}

/**
 * Set the callback function which is invoked with errors or results when the
 * zone exits
 * @param {Zone~primaryCallback} cb
 */
Zone.prototype.setCallback = function(cb) {
  if (cb != null) {
    if (typeof cb !== 'function')
      throw new TypeError('callback is not a function');

    if (this.errorFirstCallback || this.successCallback || this.errorCallback)
      throw new Error('Callback already set');

    this.errorFirstCallback = cb;
  }

  return this;
};

/**
 * Promise style callback
 * @param {function} successCB
 * @param {function} errorCB
 */
Zone.prototype.then = function(successCB, errorCB) {
  if (successCB != null) {
    if (typeof successCB !== 'function')
      throw new TypeError('callback is not a function');

    if (this.errorFirstCallback || this.successCallback)
      throw new Error('Callback already set');

    this.successCallback = successCB;
  }

  if (errorCB != null) {
    if (typeof errorCB !== 'function')
      throw new TypeError('callback is not a function');

    if (this.errorFirstCallback || this.errorCallback)
      throw new Error('Callback already set');

    this.errorCallback = errorCB;
  }

  return this;
};

/**
 * Promise style error callback
 * @param {function} errorCB
 */
Zone.prototype.catch = function(errorCB) {
  if (errorCB != null) {
    if (typeof errorCB !== 'function')
      throw new TypeError('callback is not a function');

    if (this.errorFirstCallback || this.errorCallback)
      throw new Error('Callback already set');

    this.errorCallback = errorCB;
  }

  return this;
};

/*
 * Register a child Zone with this Zone.
 * @private
 */
Zone.prototype.__register__ = function(child) {
  //update child linked list
  if (this.__last_child__) {
    this.__last_child__.__next_sibling__ = child;
  }
  child.__previous_sibling__ = this.__last_child__;
  this.__last_child__ = child;
}

/*
 * Unregister a child Zone from this Zone.
 * @private
 */
Zone.prototype.__unregister__ = function(child) {
  //update child linked list
  if (child.__previous_sibling__) {
    child.__previous_sibling__.__next_sibling__ = child.__next_sibling__;
  }
  if (child.__next_sibling__) {
    child.__next_sibling__.__previous_sibling__ = child.__previous_sibling__;
  }
  if (this.__last_child__ === child) {
    this.__last_child__ = child.__previous_sibling__;
  }
}

Zone.prototype.__increment_callback_count__ = function() {
  ++this.numOutstandingCallbacks;
}

Zone.prototype.__decrement_callback_count__ = function() {
  --this.numOutstandingCallbacks;
  if (this.numOutstandingCallbacks === 0) {
    this.enqueueFinalize();
  }
}

Zone.prototype.__apply = function(thisArg, fn, args){
  try {
    return fn.apply(thisArg, args);
  } catch (err) {
    this.throw(err);
    return null;
  }
}

/**
 * The apply() method calls a function with a given this value and arguments
 * provided as an array within this Zone.
 *
 * @param {object} thisArg The value of this provided for the call to function
 * @param {function} fn The function to invoke
 * @param {*} arguments
 */
Zone.prototype.apply = function(thisArg, fn, args) {
  if(global.zone === this){
    return fn.apply(thisArg, args);
  }else{
    var previousZone = zone;
    global.zone = this;
    var result = this.__apply(thisArg, fn, args);
    global.zone = previousZone;
    return result;
  }
};

/**
 * The applyAsync() method calls a function with a given this value 
 * and arguments provided as an array on the next tick within this Zone.
 *
 * @param {object} thisArg The value of this provided for the call to function
 * @param {function} fn The function to invoke
 * @param {*} arguments
 */
Zone.prototype.applyAsync = function(thisArg, fn, args) {
  result = scheduler.enqueueCallback(this, thisArg, fn, args);
};

/**
 * Run a function within the Zone immediately
 * @param {Object} thisArg
 * @param {function} fn The function to run
 * @param {*} arguments
 */
Zone.prototype.call = function(thisArg, fn) {
  var args = new Array(arguments.length - 2);
  for (var i = 2; i < arguments.length; i++) {
    args[i - 2] = arguments[i];
  }
  return this.apply(thisArg, fn, args);
};

/**
 * Run a function within the Zone on the next tick
 * @param {Object} thisArg
 * @param {function} fn The function to run
 * @param {*} arguments
 */
Zone.prototype.callAsync = function(thisArg, fn) {
  var args = new Array(arguments.length - 2);
  for (var i = 2; i < arguments.length; i++) {
    args[i - 2] = arguments[i];
  }
  this.applyAsync(thisArg, fn, args);
};

/**
 * Run a function within the Zone immediately
 * @param {function} fn The function to run
 * @param {*} arguments
 * @private
 */
Zone.prototype.run = function(fn) {
  var args = new Array(arguments.length - 1);
  for (var i = 1; i < arguments.length; i++) {
    args[i - 1] = arguments[i];
  }
  return this.apply(this, fn, args);
};

/**
 * On the next iteration of the event loop call the callback within this zone.
 *
 * @param {function} fn The function to wrap within this zone
 */
Zone.prototype.runNextTick = function(cb) {
  scheduler.enqueueCallback(this, this, cb)
}

/**
 * The bind() method takes a function and returns a wrapped version which
 * can be run within the zone at a later time. Unlike define, this does not
 * create a new zone to run the function.
 *
 * Note: If you choose not to autoRelease the delegate, you will need to
 * explicitly call release() to allow the zone to exit.
 *
 * @param {Object} thisArg The value of `this` within the function
 * @param {function} fn The function to wrap within this zone
 * @param {bool} [autoRelease=true] Automatically release this function after it is run
 */
Zone.prototype.bind = function(thisArg, fn, autoRelease) {
  if (autoRelease === null || autoRelease !== false) {
    autoRelease = true;
  }

  var delegate = new ZoneDelegate(this, fn, autoRelease);
  var wrapper = function() {
    return delegate.call(this, arguments);
  };
  wrapper.release = function() {
    delegate.release();
  }
  return wrapper;
}


/**
 * The bindAsync() method takes a function and returns a wrapped version which
 * when called will register a one-time async callback which will run within the
 * zone. This does not create a new zone to run the function.
 *
 * @param {Object} thisArg The value of `this` within the function
 * @param {function} fn The function to wrap within this zone
 * @param {bool} [autoRelease=true] Automatically release this function after it is run
 */
Zone.prototype.bindAsync = function(thisArg, fn, autoRelease) {
  if (autoRelease === null || autoRelease !== false) {
    autoRelease = true;
  }

  var delegate = new ZoneDelegate(this, fn, true);
  var wrapper = function() {
    return delegate.callAsync(thisArg, arguments);
  };
  wrapper.release = function() {
    delegate.release();
  }
  return wrapper;
}


/**
 * Enqueue this zone so it can be cleaned up on next tick
 * @private
 */
Zone.prototype.enqueueFinalize = function(err) {
  if (!this.finalizerScheduled && (err || (this.numDelegates === 0 && this.numOutstandingCallbacks === 0))) {
    this.finalizerScheduled = true;
    scheduler.enqueueZone(this);
  }
};

/**
 * Dequeue this zone from scheduled cleanup. This is generally done if the ref
 * count of the zone > 0
 * @private
 */
Zone.prototype.dequeueFinalize = function() {
  this.finalizerScheduled = false;
  scheduler.dequeueZone(this);
}

/**
 * Signal this zone to exit since the parent zone has either recieved a result
 * or and error. The signal method may be called multiple times by the parent
 * if the parent first succeeded but later got an error while finalizing.
 *
 * @param {error} err The error from the parent of null in succesful case.
 */
Zone.prototype.signal = function(err) {
  if (err) {
    if (this.error)
      return;

    this.error = err;
    this.result = undefined;
    this.exiting = true;

    // If the last signaled child was signaled for the reason of the zone
    // being empty, we now need to re-signal it with an error reason.
    this.__last_signaled_child__ = null;

  } else /* graceful */ {
    if (this.exiting)
      return;

    this.exiting = true;
  }
  this.enqueueFinalize(err);
}

/**
 * Triggers zone to exit with a succesful result. The result will be passed on
 * to the main or success callbacks in the parent zone
 *
 * @param {*} arguments The return values to pass to callbacks
 */
Zone.prototype.return = function() {
  if (this.error)
    return;
  else if (this.result !== undefined)
    return void this.throw(new Error('Zone result already set.'));

  this.result = Array.prototype.slice.call(arguments);
  this.exiting = true;
  this.enqueueFinalize();
}

/**
 * Triggers zone to exit.
 *
 * @param {error} err Error to pass back or null if succesful.
 * @param {*} arguments The return values to pass to callbacks
 */
Zone.prototype.complete = function(err) {
  if (err != null){
    return this.throw(err);
  } else {
    var args = new Array(arguments.length - 1);
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
    return this.
    return .apply(this, args);
  }
};

/**
 * Triggers zone to exit with an error
 *
 * @param {error} err Error to pass back or null if succesful.
 */
Zone.prototype.throw = function(err) {
  // Todo: There is something to be said for an 'error' event... This means the
  // first error is returned, but no subsequent. If the zone is waiting for a
  // resource to finalize, but it can't because of an error, which is made more
  // likely because something is already wrong, then it will stall indefinitely,
  // without feedback. Not sure what solution is, but I think an alternative to
  // silence, even if just in debug mode, needs to be found.
  if (this.error)
    return;

  if (!(err instanceof Error))
    err = new NonError(err);

  if (!err.zone) {
    Object.defineProperty(err,
      'zone', {
        value: zone,
        enumerable: false
      });
  }

  this.result = undefined;
  this.error = err;
  this.exiting = true;

  // If the last signaled child was signaled for the reason of the zone
  // being empty, we now need to re-signal it with an error reason.
  this.__last_signaled_child__ = null;
  this.enqueueFinalize(err);
};

/**
 * Helper function to isolate try-finally clause for optimization
 * @private
 */
Zone.prototype._finalizeHelper = function(childToSignal) {
  var previousZone = zone;
  zone = this;
  try {
    childToSignal.signal(this.error);
  } finally {
    zone = previousZone;
  }
}

/**
 * Cleanup this zone's children followed by the zone itself
 * @private
 */
Zone.prototype.__finalize__ = function() {
  this.finalizerScheduled = false;
  assert(!this.closed);

  if (this.numOutstandingCallbacks > 0) {
    return;
  }

  if (!this.__last_child__) {
    //all children zones and delegates have been cleaned up

    this.closed = true;
    if (!this.isRoot) {
      if (this.errorFirstCallback) {
        //call the main callback
        scheduler.enqueueCallback(this.parent, this.parent,
          this.errorFirstCallback, [this.error].concat(this.result || []));
      } else if (!this.error && this.successCallback) {
        //success so call the success callback
        scheduler.enqueueCallback(this.parent, this.parent,
          this.successCallback,
          this.result || []);
      } else if (this.error && this.errorCallback) {
        //error so call the error callback
        scheduler.enqueueCallback(this.parent,
          this.parent,
          this.errorCallback, [this.error]);
      } else if (this.error) {
        //no callbacks registered. Let parent cleanup this zone and other 
        //sibling zones
        this.parent.throw(this.error);
      }
      this.parent.__unregister__(this);
    } else if (this.error) {
      //error in root zone
      console.error(this.error.zoneStack);
      process.exit(1);
    }
  } else if (this.__last_signaled_child__ !== this.__last_child__) {
    //This case is triggered if the last signal child caused new child
    //delegte to be created. (eg: TCP socket cleanup causes close event to be
    //triggered)

    //signal the new last child
    this.__last_signaled_child__ = this.__last_child__;
    if (this.__last_signaled_child__) {
      this._finalizeHelper(this.__last_signaled_child__);
    }
  }
}

/**
 * Check zone callback and options
 * @private
 */

function _parseZoneOptions(options, callback) {
  if (callback === undefined && typeof options === 'function') {
    callback = options;
    options = undefined;
  }

  if (!options) {
    options = {};
  }

  if (callback != null && typeof callback !== 'function') {
    throw new TypeError('callback is not a function');
  }

  return [options, callback];
}

Zone.prototype.Zone = Zone;

// Constructor for the root zone.

function RootZone() {
  Zone.call(this, null, {
    'isConstructingRootZone': true
  });
}

RootZone.prototype = Zone.prototype;

exports.RootZone = RootZone;
exports.Zone = Zone;
