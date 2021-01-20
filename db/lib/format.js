const { isDate } = require('util').types
const { isArray } = Array
const { isBuffer } = Buffer

function toLiteral (value) {
  switch (typeof value) {
    case 'string':
      return value.includes('\\')
        ? `E'${value.replace(/'|\\/g, '$&$&')}'`
        : `'${value.replace(/'/g, '\'\'')}'`
    case 'number':
    case 'boolean':
      return String(value)
    case 'undefined':
    case 'object':
      if (value == null) return 'NULL'
      if (isDate(value)) return `'${value.toISOString()}'`
      if (isArray(value)) return value.length === 0 ? '\'{}\'' : `array[${value.map(toLiteral)}]`
      if (isBuffer(value)) return `E'\\\\x${value.toString('hex')}'`
      return toLiteral(JSON.stringify(value))
    // case 'function':
    //   return value(toLiteral)
    default:
      throw new TypeError(`the ${typeof value} can not be converted to a SQL literal`)
  }
}

function toIdentifier (value) {
  const str = String(value)
  return str.length === 1 && /^[a-z]$/.test(str) ? str : `"${str.replace(/"/g, '""')}"`
}

module.exports = {
  toLiteral,
  toIdentifier,
}
