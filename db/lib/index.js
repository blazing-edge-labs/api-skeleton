const { sql, Sql } = require('./sql')
const { Database } = require('./db')

const originalQuery = Database.prototype.query

Database.prototype.query = function query (query) {
  if (typeof query === 'string') {
    throw new TypeError('query: simple string not allowed. Use .sql`...` or .query({ text: \'SELECT ...\' })')
  }
  const arg = query instanceof Sql ? query.source : query
  return originalQuery.call(this, arg)
}

Database.prototype.sql = function runSql (...args) {
  return this.query(sql(...args))
}

Database.prototype.update = function update (options) {
  return this.query(sql.update(options))
}

Database.prototype.insert = function insert (options) {
  return this.query(sql.insert(options))
}

module.exports = {
  sql,
  Sql,
  Database,
}
