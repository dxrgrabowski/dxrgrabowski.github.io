'use strict';

/*
 * grunt
 * http://gruntjs.com/
 *
 * Copyright (c) 2016 "Cowboy" Ben Alman
 * Licensed under the MIT license.
 * https://github.com/gruntjs/grunt/blob/master/LICENSE-MIT
 */

// Normalize linefeeds in a string.
var linefeed = process.platform === 'win32' ? '\r\n' : '\n';

module.exports = function(str) {
  return str.replace(/\r\n|\n/g, linefeed);
};
