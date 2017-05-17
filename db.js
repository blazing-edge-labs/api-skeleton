const Promise = require('bluebird')
const path = require('path')
const pgp = require('pg-promise')({
  promiseLib: Promise,
})

const queryFiles = new Map()

function sql (filename) {
  if (!queryFiles.has(filename) || process.env.NODE_ENV === 'development') {
    queryFiles.set(filename, new pgp.QueryFile(path.join('repo', 'query', `${filename}.sql`), {
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
}
