const { sql, _sql, isSql } = require('./sql')
const { Database } = require('./db')

const methods = [
  'any',
  'one',
  'oneOrNone',
  'many',
  'none',
  'query',
  'result',
]

for (const name of methods) {
  const original = Database.prototype[name]
  Database.prototype[name] = function (str, ...values) {
    if (isSql(str)) {
      return original.call(this, str)
    }
    if (typeof str === 'string') {
      throw new TypeError('db method called with a string')
      // if (values.length > 0) throw new Error('db method called with a string and values')
      // return original.call(this, str)
    }

    return original.call(this, _sql(str, values))
  }
}

module.exports = {
  sql,
  isSql,
  Database,
}
