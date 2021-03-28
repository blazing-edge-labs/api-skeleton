const pgp = require('pg-promise')()

const error = require('error')
const { Database, sql, isSql } = require('db/lib')

/// PG stuff

// https://github.com/brianc/node-pg-types/issues/50
const DATE_OID = 1082
pgp.pg.types.setTypeParser(DATE_OID, v => v)

/// DB stuff

const pgpDB = pgp(process.env.DATABASE_URL)

const db = new Database(pgpDB.$pool, {
  queryErrorHandler: (e, query) => {
    // console.log('------\n', query)
    // console.error(e)
    throw error('db.query', e)
  },
  debug: process.env.NODE_ENV === 'development',
})

module.exports = {
  db,
  sql,
  isSql,
  pgpDB,
  helper: pgp.helpers,
  pgp,
}
