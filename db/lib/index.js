const { sql } = require('./sql')
// const { toLiteral } = require('./format')
const { Database } = require('./db')

Database.prototype.sql = function runSql (...args) {
  const values = []
  const source = sql(...args)(val => `$${values.push(val)}`)
  return this.query(source, values)
  // const query = sql(...args)(toLiteral)
  // return this.query(query)
}

module.exports = {
  sql,
  Database,
}
