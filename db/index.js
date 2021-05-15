const { Pool, types } = require('pg')

const { Database, sql } = require('db/lib')
const error = require('error')

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
}
