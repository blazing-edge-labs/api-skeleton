const { sql, Sql } = require('./sql')
const { Database } = require('./db')

Database.prototype.sql = function runSql (...args) {
  return this.query(sql(...args).source)
}

Database.prototype.update = function update (options) {
  return this.query(sql.update(options).source)
}

Database.prototype.insert = function insert (options) {
  return this.query(sql.insert(options).source)
}

module.exports = {
  sql,
  Sql,
  Database,
}
