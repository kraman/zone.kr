var ZoneDelegate = function ZoneDelegate(zone_, fn, autoRelease_){
	this.autoRelease = false;
	if(autoRelease_){
		this.autoRelease = true;
	}
	this.wrappedFn = fn;
	this.zone = zone_;
  
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
	
  this.zone.__register__(this);
  ++this.zone.numDelegates;
}

ZoneDelegate.prototype.call = function(thisArg, args) {
	var result = this.zone.apply(thisArg, this.wrappedFn, args);
	if (this.autoRelease) {
		this.release();
	}
	return result;
}

ZoneDelegate.prototype.callAsync = function(thisArg, args) {
	var result = this.zone.applyAsync(thisArg, this.wrappedFn, args);
  
  //It is ok to release at this point since the callback has been registered
	this.release();
	return result;
}

ZoneDelegate.prototype.release = function() {
	this.zone.__unregister__(this);
	--this.zone.numDelegates;
	if (this.zone.numDelegates == 0 && !this.zone.finalizerScheduled) {
		this.zone.enqueueFinalize();
	}
}

ZoneDelegate.prototype.signal = function(err) {
  this.release();
}

module.exports = ZoneDelegate;