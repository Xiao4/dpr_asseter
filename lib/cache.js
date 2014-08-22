
/*!
 * Connect - Cache
 * Copyright(c) 2011 Sencha Inc.
 * MIT Licensed
 */

/**
 * Expose `Cache`.
 */

module.exports = Cache;

/**
 * LRU cache store.
 *
 * @param {Number} limit
 * @api private
 */

function Cache(limit) {
  this.store = {};
  this.keys = [];
  this.limit = limit;
}

/**
 * Touch `key`, promoting the object.
 *
 * @param {String} key
 * @param {Number} i
 * @api private
 */

Cache.prototype.touch = function(key, i){
  this.keys.splice(i,1);
  this.keys.push(key);
};

/**
 * Remove `key`.
 *
 * @param {String} key
 * @api private
 */

Cache.prototype.remove = function(key){
  console.log('Cache remove:', key,' Cache size:', this.keys.length);
  delete this.store[key];
};

/**
 * Get the object stored for `key`.
 *
 * @param {String} key
 * @return {Array}
 * @api private
 */

Cache.prototype.get = function(key){
  return this.store[key];
};

/**
 * Add a cache `key`.
 *
 * @param {String} key
 * @return {Array}
 * @api private
 */

Cache.prototype.add = function(key){
  var arr, len;
  // initialize store
  if(typeof this.store[key] !== "undefined"){
    arr = this.store[key];
    len = this.keys.length;
  }else{
    arr = this.store[key] = [];
    len = this.keys.push(key);
    arr.createdAt = new Date;
  }

  // limit reached, invalidate LRU
  if (len > this.limit) {
    this.remove(this.keys.shift());
    console.log('Cache full:', this.keys.length, ' of ', this.limit);
  }

  return arr;
};
