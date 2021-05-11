const { sql, isSql } = require('./sql')
const { Database } = require('./db')

Database.prototype.sql = function execSql (...args) {
  return this.query(sql(...args).source)
}

module.exports = {
  sql,
  isSql,
  Database,
}
