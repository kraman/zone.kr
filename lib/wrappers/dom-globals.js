var realSetTimeout = global.setTimeout;
var realClearTimeout = global.clearTimeout;

global.setTimeout = function(cb, timeout){
  var delegate = zone.bind(null, cb);
  delegate.signal = function(err){
    if(err || timeout === 0) {
      clearTimeout(delegate);
    }
  }
  var handle = realSetTimeout(delegate, timeout);
  delegate.timeoutHandle = handle;
  return delegate;
}

global.clearTimeout = function(delegate){
  realClearTimeout(delegate.timeoutHandle);
  delegate.release();
  delegate.timeoutHandle = null;
}

var realSetInterval = global.setInterval;
var realClearInterval = global.clearInterval;

global.setInterval = function(cb, interval){
  var delegate = zone.bind(null, cb,false);
  delegate.signal = function(err){
    if(err) {
      clearInterval(delegate);
    }
  }
  var handle = realSetInterval(delegate, interval);
  delegate.timeoutHandle = handle;
  return delegate;
}

global.clearInterval = function(delegate){
  realClearInterval(delegate.timeoutHandle);
  delegate.release();
  delegate.timeoutHandle = null;
}

var realSetImmediate = global.setImmediate;
var realClearImmediate = global.clearImmediate;

global.setImmediate = function(cb, timeout){
  var delegate = zone.bind(null, cb,false);
  delegate.signal = function(err){
    if(err) {
      clearImmediate(delegate);
    }
  }
  var handle = realSetImmediate(delegate, timeout);
  delegate.timeoutHandle = handle;
  return delegate;
}

global.clearImmediate = function(delegate){
  realClearImmediate(delegate.timeoutHandle);
  delegate.release();
  delegate.timeoutHandle = null;
}