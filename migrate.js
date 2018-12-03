const argv = require('minimist')(process.argv.slice(2), {
  boolean: true,
  stopEarly: true,
})
const migratio = require('migratio')

const { db, sql, pgp } = require('db')

const command = argv._[0]
const opts = {
  directory: 'migration',
  tableName: 'migration',
  verbose: true,
}

function end () {
  process.exit(0)
}

function finalize () {
  pgp.end()
}

function fail (err) {
  console.error(err)
  process.exit(1)
}

if (argv.r) {
  opts.revision = argv.r
}

(function () {
  switch (command) {
    case 'up':
      return migratio.up(opts).finally(finalize).then(end, fail)
    case 'down':
      return migratio.down(opts).finally(finalize).then(end, fail)
    case 'current':
      return migratio.current(opts).finally(finalize).then(end, fail)
    case 'recreate':
      return db.query(sql('schema')).finally(finalize).then(end, fail)
    case 'seed':
      return db.tx(function (t) {
        return t.query(sql('seed'))
      }).finally(finalize).then(end, fail)
    default:
      throw new Error(`"${command}" is not a valid migration command`)
  }
})()
