const { Pool, types } = require('pg')

const error = require('error')

const { Database, sql, Sql } = require('db/lib')
const format = require('db/lib/format')

// https://github.com/brianc/node-pg-types/issues/50
const DATE_OID = 1082
types.setTypeParser(DATE_OID, v => v)

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const db = new Database(pool, {
  queryErrorHandler: (e, query) => {
    // console.log('------\n', query)
    // console.error(e)
    throw error('db.query', e)
  },
  debug: process.env.NODE_ENV !== 'production',
})

module.exports = {
  db,
  sql,
  format,
  Database,
  Sql,
}
