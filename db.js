const pgp = require('pg-promise')()

// https://github.com/brianc/node-pg-types/issues/50
const DATE_OID = 1082
pgp.pg.types.setTypeParser(DATE_OID, v => v)

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
  db: pgp(process.env.DATABASE_URL),
  helper: pgp.helpers,
  pgp,
  sql,
  util: pgp.utils,
}
