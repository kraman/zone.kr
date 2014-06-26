module.exports = function(binding) {
  var Zone = zone.Zone;
  var Gate = zone.Gate;
  var uid = require('../../Uid.js');
  var util = require('util');

  var pipe_wrap = binding('pipe_wrap');
  var tcp_wrap = binding('tcp_wrap');
  var tty_wrap = binding('tty_wrap');

  patchPrototype(pipe_wrap.Pipe.prototype);
  patchPrototype(tcp_wrap.TCP.prototype);
  patchPrototype(tty_wrap.TTY.prototype);

  function Pipe() {
    return (new pipe_wrap.Pipe()).__init__();
  }

  function TCP() {
    return (new tcp_wrap.TCP()).__init__();
  }

  function TTY(fd, readable) {
    return (new tty_wrap.TTY(fd, readable)).__init__(fd);
  }

  return {
    isTTY: tty_wrap.isTTY,
    guessHandleType: tty_wrap.guessHandleType,
    Pipe: Pipe,
    TCP: TCP,
    TTY: TTY
  };

  function patchPrototype(prototype) {
    prototype.__init__ = function __init__(fd) {
      this.__fd__ = fd;
      this.__zone__ = zone;
      
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

      //FDs <= 2 are un-closable, so their handles should be cleaned up last.
      if (fd === 'number' && fd <= 2) {
        this.__zone__ = zone.root;
      }
      this.__zone__.__register__(this);

      if (prototype.readStart) {
        this.__init_read__();
      }
      if (prototype.writeBuffer) {
        this.__init_write__();
      }
      return this;
    }

    if (prototype.open) {
      var realOpen = prototype.open;

      prototype.open = function(fd) {
        // Delegate to the binding layer first, so if open fails we can
        // immediately bail out.
        var result = realOpen.apply(this, arguments);
        if (result < 0)
          return result;

        // Open succeeded.
        this.__fd__ = fd;

        //FDs <= 2 are un-closable, so their handles should be cleaned up last.
        if (fd === 'number' && fd <= 2) {
          this.__zone__ = zone.root;
        }

        // Re-register if this is a non-closable fd.
        this.__zone__.__unregister__(this);
        this.__zone__.__register__(this);

        return result;
      };
    }

    // Close
    var realClose = prototype.close;
    prototype.close = function close(cb) {
      if (this.__close_cb__) {
        throw new Error('Handle is already closing or closed.');
      }

      this.closed = true;
      this.__close_cb__ = this.__zone__.bindAsync(this, cb);
      realClose.call(this, OnClose);
    };

    function OnClose() {
      if (this.__onread_cb__) {
        this.__onread_cb__.release();
      }
      if (this.__onwrite_cb__){
        this.__onwrite_cb__.release();
      }
      if (this.__onconnection_cb__) {
        this.__onconnection_cb__.release();
      }

      if (this.__close_cb__) {
        this.__close_cb__.apply(this, arguments)
        this.__close_cb__ = null;
      }
      this.__zone__.__unregister__(this);
    }

    // Listen/accept methods
    if (prototype.listen) {
      function onConnection(err, clientHandle) {
        // Temporarily enter the server zone and then init the client handle,
        // so it gets registered to the server zone too.
        var curZone = zone;
        zone = this.__zone__;
        clientHandle.__init__();
        zone = curZone;

        return this.__onconnection_cb__.apply(this, arguments);
      }

      function getWrappedOnConnection() {
        return onConnection;
      }

      function setOnConnectionCallback(cb) {
        this.__onconnection_cb__ = this.__zone__.bindAsync(this, cb, false);
        var self = this;
        this.__onconnection_cb__.signal = function(err) {
          if (!err) {
            return;
          }
          self.signal(err);
        }
      }

      Object.defineProperty(prototype, 'onconnection', {
        get: getWrappedOnConnection,
        set: setOnConnectionCallback
      });
    }

    // Write methods
    if (prototype.writeBuffer) {
      prototype.writeBuffer = wrapWriteMethod(prototype.writeBuffer);
    }
    if (prototype.writeAsciiString) {
      prototype.writeAsciiString = wrapWriteMethod(prototype.writeAsciiString);
    }
    if (prototype.writeUtf8String) {
      prototype.writeUtf8String = wrapWriteMethod(prototype.writeUtf8String);
    }
    if (prototype.writeUcs2String) {
      prototype.writeUcs2String = wrapWriteMethod(prototype.writeUcs2String);
    }
    if (prototype.writev) {
      prototype.writev = wrapWriteMethod(prototype.writev);
    }

    // Shutdown
    if (prototype.shutdown) {
      prototype.shutdown = wrapWriteMethod(prototype.shutdown);
    }
    
    prototype.__init_write__ = function() {
      this.__onwrite_cb__ = this.__zone__.bindAsync(this, OnWriteComplete, false);
    }
    
    function OnWriteComplete(req, args){
      //this = req
      req.__oncomplete__.apply(req, args);
      req.oncomplete = null;
    }

    function wrapWriteMethod(baseMethod) {
      return function(req) {
        req.__oncomplete__ = req.oncomplete;
        var __onwrite_cb__ = this.__onwrite_cb__;
        req.oncomplete = function(){
          __onwrite_cb__(this, arguments);
        }

        var result = baseMethod.apply(this, arguments);
        if (result < 0 || req.async === false) {
          req.oncomplete = null;
          req.__oncomplete__ = null;
        }
        return result;
      }
    }

    // Read methods
    if (prototype.readStart) {
      var realReadStart = prototype.readStart;
      var realReadStop = prototype.readStop;

      prototype.__init_read__ = function() {
          this.__onread_user_cb__ = null;
          this.__onread_cb__ = this.__zone__.bindAsync(this, OnRead, false);
          this.__onread_cb__.signal = function(err) {
            if (!err) {
              return;
            }
            self.readStop();
        }
      }

      function OnRead() {
        if (this.__onread_user_cb__) {
          this.__onread_user_cb__.apply(this, arguments);
        }
      }

      function getWrappedOnRead() {
        if (this.__onread_user_cb__){
        return this.__onread_cb__;
        }
        return null;
      }

      function setOnReadCallback(cb) {
        this.__onread_user_cb__ = cb;
      }

      prototype.readStop = function() {
        if (this.__onread_user_cb__)
          this.__onread_user_cb__ = null;
        return realReadStop.apply(this, arguments);
      };

      Object.defineProperty(prototype, 'onread', {
        get: getWrappedOnRead,
        set: setOnReadCallback
      });
    }

    // Cleanup
    prototype.signal = function signal(error) {
      // Of course we could use the handle's close() method here, but then the
      // lib wrappers would never know about it. Therefore the close call is
      // routed through the lib wrapper. This must be either a net.Server that
      // exposes .close(), or a net.Socket that exposes .destroy().
      // However don't try to close stdio handles because they throw.
      var owner = this.owner;

      if (this.__fd__ >= 0 && this.__fd__ <= 2)
        this.__zone__.__unregister__(this);
      else if (owner.close)
        owner.close();
      else if (owner.writable && owner.destroySoon)
        owner.destroySoon();
      else
        owner.destroy();
    };
  }
}
