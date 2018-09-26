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

if (command === 'up') {
  migratio.up(opts).catch(fail)
} else if (command === 'down') {
  migratio.down(opts).catch(fail)
} else if (command === 'current') {
  migratio.current(opts).catch(fail)
} else if (command === 'recreate') {
  db.query(sql('schema')).finally(finalize).catch(fail)
} else if (command === 'seed') {
  db.tx(function (t) {
    return t.query(sql('seed'))
  }).finally(finalize).catch(fail)
} else {
  fail('invalid migration command')
}
