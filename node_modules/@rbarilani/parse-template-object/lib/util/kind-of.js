'use strict';

/*
 * grunt
 * http://gruntjs.com/
 *
 * Copyright (c) 2016 "Cowboy" Ben Alman
 * Licensed under the MIT license.
 * https://github.com/gruntjs/grunt/blob/master/LICENSE-MIT
 */

// What "kind" is a value?
// I really need to rework https://github.com/cowboy/javascript-getclass
var kindsOf = {};
'Number String Boolean Function RegExp Array Date Error'.split(' ').forEach(function(k) {
  kindsOf['[object ' + k + ']'] = k.toLowerCase();
});
module.exports = function(value) {
  // Null or undefined.
  if (value == null) { return String(value); }
  // Everything else.
  return kindsOf[kindsOf.toString.call(value)] || 'object';
};
