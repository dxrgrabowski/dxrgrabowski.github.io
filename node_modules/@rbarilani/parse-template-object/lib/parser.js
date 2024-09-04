'use strict';

var getobject = require('getobject');
var merge = require('lodash').merge;
var recurse = require('./util/recurse');
var template = require('./template');

// Match '<%= FOO %>' where FOO is a propString, eg. foo or foo.bar but not
// a method call like foo() or foo.bar().
var PROP_STRING_TMPL_RE = /^<%=\s*([a-z0-9_$]+(?:\.[a-z0-9_$]+)*)\s*%>$/i;

var parser = module.exports = function (prop, value) {
    if (arguments.length === 2) {
        // Two arguments were passed, set the property's value.
        return parser.set(prop, value);
    } else {
        // Get the property's value (or the entire data object).
        return parser.get(prop);
    }
};

parser.data = {};

parser.init = function (object, options) {
    this.data = object || {};
    this.options = options || {};
    return this;
};

parser['get'] = function (prop) {
    return this.process(this.getRaw(prop));
};

parser.set = function (prop, value) {
    return getobject.set(this.data, this.getPropString(prop), value);
};

parser.getRaw = function (prop) {
    if (prop) {
        // Prop was passed, get that specific property's value.
        return getobject.get(this.data, this.getPropString(prop));
    } else {
        // No prop was passed, return the entire config.data object.
        return this.data;
    }
};

parser.process = function (raw) {
    return recurse(raw, function (value) {
        // If the value is not a string, return it.
        if (typeof value !== 'string') {
            return value;
        }
        // If possible, access the specified property via config.get, in case it
        // doesn't refer to a string, but instead refers to an object or array.
        var matches = value.match(PROP_STRING_TMPL_RE);
        var result;
        if (matches) {
            result = this.get(matches[1]);
            // If the result retrieved from the config data wasn't null or undefined,
            // return it.
            if (result != null) {
                return result;
            }
        }
        // Process the string as a template.
        return template.process(value, {
          data: this.data,
          imports: this.options.imports || {}
        });
    }.bind(this));
};

parser.getPropString = function (prop) {
    return Array.isArray(prop) ? prop.map(this.escape).join('.') : prop;
};

parser.merge = function (obj) {
    merge(this.data, obj || {});
    return this.data;
};

parser.escape = function (str) {
    return str.replace(/\./g, '\\.');
};
