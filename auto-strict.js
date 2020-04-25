'use strict'
/**
 * Until we switch to ES modules (Nodejs 14?)
 * this will enforce strict mode in our .js files
 * without the need of adding "use strict" on top of each file.
 * 'node_modules' are ignored!
 *
 * Why bother with strict mode at all?
 * In short: Safety and Performance.
 * For more info: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode
 */

const path = require('path')
const includePrefix = path.join(__dirname, 'x').slice(0, -1)
const excludePrefix = path.join(__dirname, 'node_modules', 'x').slice(0, -1)

const Module = require('module')
const { _compile } = Module.prototype

Module.prototype._compile = function (content, filename) {
  if (
    filename.endsWith('.js') &&
    filename.startsWith(includePrefix) &&
    !filename.startsWith(excludePrefix)
  ) {
    content = `'use strict'; ${content}`
  }
  return _compile.call(this, content, filename)
}
