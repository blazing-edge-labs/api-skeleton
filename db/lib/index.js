const { sql, Sql } = require('./sql')
const { Database } = require('./db')

Database.prototype.sql = function runSql (...args) {
  return this.query(sql(...args).source)
}

module.exports = {
  sql,
  Sql,
  Database,
}
