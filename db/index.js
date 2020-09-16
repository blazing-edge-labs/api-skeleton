const pgp = require('pg-promise')({
  // error (_err, e) { console.log('------\n', e.query) },
  // query (e) { console.log('------\n', e.query) },
})

const error = require('error')
const { wrapDatabase } = require('utils/pgp-wrappers')

/// PG stuff

// https://github.com/brianc/node-pg-types/issues/50
const DATE_OID = 1082
pgp.pg.types.setTypeParser(DATE_OID, v => v)

/// DB stuff

const pgpDB = pgp(process.env.DATABASE_URL)

const db = wrapDatabase(pgpDB, {
  queryErrorHandler: e => {
    throw error('db.query', e)
  },
})

/// sql(file)

const queryFiles = new Map()

function sql (filename) {
  if (!queryFiles.has(filename) || process.env.NODE_ENV === 'development') {
    queryFiles.set(filename, new pgp.QueryFile(`${filename}.sql`, {
      compress: process.env.NODE_ENV === 'production',
      debug: process.env.NODE_ENV === 'development',
    }))
  }

  return queryFiles.get(filename)
}

module.exports = {
  db,
  pgpDB,
  helper: pgp.helpers,
  pgp,
  sql,
  util: pgp.utils,
}
