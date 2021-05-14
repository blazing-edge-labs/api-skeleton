const { sql } = require('./sql')
// const { toLiteral } = require('./format')
const { Database } = require('./db')

Database.prototype.sql = function runSql (...args) {
  return this.query(sql(...args))
}

module.exports = {
  sql,
  Database,
}
