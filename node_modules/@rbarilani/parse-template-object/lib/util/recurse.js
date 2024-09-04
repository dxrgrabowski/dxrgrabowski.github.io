'use strict';

/*
 * grunt
 * http://gruntjs.com/
 *
 * Copyright (c) 2016 "Cowboy" Ben Alman
 * Licensed under the MIT license.
 * https://github.com/gruntjs/grunt/blob/master/LICENSE-MIT
 */

var kindOf = require('./kind-of');

// Recurse through objects and arrays, executing fn for each non-object.
module.exports = function(value, fn, fnContinue) {
  function recurse(value, fn, fnContinue, state) {
    var error;
    if (state.objs.indexOf(value) !== -1) {
      error = new Error('Circular reference detected (' + state.path + ')');
      error.path = state.path;
      throw error;
    }
    var obj, key;
    if (fnContinue && fnContinue(value) === false) {
      // Skip value if necessary.
      return value;
    } else if (kindOf(value) === 'array') {
      // If value is an array, recurse.
      return value.map(function(item, index) {
        return recurse(item, fn, fnContinue, {
          objs: state.objs.concat([value]),
          path: state.path + '[' + index + ']',
        });
      });
    } else if (kindOf(value) === 'object' && !Buffer.isBuffer(value)) {
      // If value is an object, recurse.
      obj = {};
      for (key in value) {
        obj[key] = recurse(value[key], fn, fnContinue, {
          objs: state.objs.concat([value]),
          path: state.path + (/\W/.test(key) ? '["' + key + '"]' : '.' + key),
        });
      }
      return obj;
    } else {
      // Otherwise pass value into fn and return.
      return fn(value);
    }
  }
  return recurse(value, fn, fnContinue, {objs: [], path: ''});
};
