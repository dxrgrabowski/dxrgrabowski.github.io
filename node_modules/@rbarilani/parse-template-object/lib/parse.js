'use strict';

var parser = require('./parser');

module.exports = function (object, options) {
    return parser
      .init(object, options)
      .get();
};
