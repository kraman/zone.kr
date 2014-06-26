module.exports = LinkedList;

function LinkedListIterator(list, head, tail) {
  this._list = list;
	this._head = head;
	this._tail = tail;
	this.current = list;

  this.prev = function() {
    this.current = this.current.prev;
    if (this.current && this.current !== this._list) {
      return this.current.value;
		}else{
      this.current = null;      
			return null;
    }
  }

  this.next = function() {
    this.current = this.current.next;
    if (this.current && this.current !== this._list) {
      return this.current.value;
		}else{
      this.current = null;
			return null;
    }
  }
}

function ListItem(object, prev, next){
	this.value = object;
	this.prev = prev;
	this.next = next;
}

function LinkedList(name) {
	this.prev = this; //tail
	this.next = this; //head
	this.name = name;
	
	this.push = function(object){
		if(this.empty()){
			this.next = this.prev = new ListItem(object, this, this);
		}else{
      var newEntry = new ListItem(object, this.prev, this);
      this.prev.next = newEntry;
      this.prev = newEntry;
		}
	}
  
	this.unshift = function(object){
		if(this.empty()){
			this.next = this.prev = new ListItem(object, this, this);
		}else{
      var newEntry = new ListItem(object, this, this.next);
      this.next.prev = newEntry;
      this.next = newEntry;
		}
	}
	
	this.pop = function(){
		if(this.empty()){
			return null;
		}else{
      var entry = this.prev;
      if(entry.prev === this){
        this.next = this;
        this.prev = this;
      }else{
        this.prev = entry.prev;
      }

      return entry.value;
		}
	}
	
	this.shift = function(){
		if(this.empty()){
			return null;
		}else{
      var entry = this.next;
      if(entry.next === this){
        this.next = this;
        this.prev = this;
      }else{
        this.next = entry.next;
      }

      return entry.value;
		}
	}
		
  this.tail = function(){
		if(this.empty()){
			return null;
		}else{
      return this.prev.value;
    }
  }

  this.head = function(){
		if(this.empty()){
			return null;
		}else{
      return this.next.value;
    }
  }

  this.empty = function() {
    return this.next === this;
  };
	
	this.remove = function(object){
    if(!this.empty()){
  		for(var c = this.next; c !== this ; c = c.next){
  			if(c.value === object){
          c.prev.next = c.next;
          c.next.prev = c.prev;
  				return;
  			}
  		} 
    }
	}

  this.iterator = function() {
    return new LinkedListIterator(this, this.next, this.prev);
  };
}