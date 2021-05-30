const pg = require('pg')
const lib = require('db/lib')
const error = require('error')

// Don't store DB dates in Date!
pg.types.setTypeParser(1082, v => v)

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
})

const db = new lib.Database(pool, {
  queryErrorHandler: (e, query) => {
    // console.log('------\n', query)
    throw error('db.query', e)
  },
  debug: process.env.NODE_ENV !== 'production',
})

module.exports = {
  ...lib,
  db,
}
