var realBinding = process.binding;
var bindingCache = {};

process.binding = binding;

function binding(name) {
  if (name in bindingCache)
    return bindingCache[name];

  switch (name) {
    case 'pipe_wrap':
    case 'tcp_wrap':
    case 'tty_wrap':
      var wb = require('./binding/stream-wrap.js')(realBinding);
      bindingCache.pipe_wrap = wb;
      bindingCache.tcp_wrap = wb;
      bindingCache.tty_wrap = wb;
      return wb;

    case 'cares_wrap':
      var wb = require('./binding/cares-wrap.js')(realBinding);
      bindingCache.cares_wrap = wb;
      return wb;
    default:
      return realBinding(name);
  }
}
