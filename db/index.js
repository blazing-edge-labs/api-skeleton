const pgp = require('pg-promise')({
  // error (_err, e) { console.log('------\n', e.query) },
  // query (e) { console.log('------\n', e.query) },
})

const error = require('error')
const { Database, sql } = require('db/lib')

/// PG stuff

// https://github.com/brianc/node-pg-types/issues/50
const DATE_OID = 1082
pgp.pg.types.setTypeParser(DATE_OID, v => v)

/// DB stuff

const pgpDB = pgp(process.env.DATABASE_URL)

const db = new Database(pgpDB.$pool, {
  queryErrorHandler: e => {
    throw error('db.query', e)
  },
})

module.exports = {
  db,
  sql,
  pgpDB,
  helper: pgp.helpers,
  pgp,
}
