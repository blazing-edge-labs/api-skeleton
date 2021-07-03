const pg = require('pg')
const { Database, Sql, sql, format } = require('hrid')
const error = require('error')

// Don't store DB dates in Date!
pg.types.setTypeParser(1082, v => v)

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
})

const db = new Database(pgPool, {
  queryErrorHandler: (e, query) => {
    // console.log('------\n', query)
    throw error('db.query', e)
  },
  debug: process.env.NODE_ENV !== 'production',
})

module.exports = {
  db,
  Sql,
  sql,
  format,
}
