# Parse Template Object

Parse objects that use templates as values (like grunt config).
It's actually based/derived on [grunt config mechanism](https://github.com/gruntjs/grunt).

[![Build Status](https://travis-ci.org/rbarilani/parse-template-object.svg?branch=master)](https://travis-ci.org/rbarilani/parse-template-object)

### Install

```
npm install @rbarilani/parse-template-object --save
```

### Usage

```javascript

//
// Basic usage
//
var parse = require('@rbarilani/parse-template-object');

var object = {
    meta: { version: '1.1.0' },
    package: {
        name: 'awesome-<%= meta.version %>'
    },
    arr: ['foo', '<%= package.name %>']
};

console.log(parse(object));

// OUT:
//
// {
//     meta: { version: '1.1.0' },
//     package: {
//         name: 'awesome-1.1.0'
//     }
//     arr: ['foo', 'awesome-1.1.0']
// }
// ------------------------------------

//
// Add extra context with "imports" options
//
var object2 = {
    package: {
        name: 'awesome-<%= meta.version %>'
    },
    arr: ['foo', '<%= package.name %>']
};

var parsed2 = parse(object2, {
  imports: {
    meta: { version: '1.1.0'}
  }
});

console.log(parsed2);

// OUT:
//
// {
//     package: {
//         name: 'awesome-1.1.0'
//     }
//     arr: ['foo', 'awesome-1.1.0']
// }
// ------------------------------------
```

### LICENSE

Copyright 2017 Ruben Barilani

Project is released under the MIT license. See LICENSE for details.

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License
