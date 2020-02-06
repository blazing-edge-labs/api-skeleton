const argv = require('mri')(process.argv.slice(2), {
  boolean: true,
  stopEarly: true,
})
const migratio = require('migratio')

const { db, sql, pgp } = require('db')

const command = argv._[0]

async function run () {
  switch (command) {
    case 'up':
    case 'down':
    case 'current':
      return migratio[command]({
        directory: 'migration',
        tableName: 'migration',
        verbose: true,
        revision: argv.r,
      })
    case 'recreate':
      return db.query(sql('schema'))
    case 'seed':
      return db.tx(t => {
        return t.query(sql('seed'))
      })
    default:
      throw new Error(`"${command}" is not a valid migration command`)
  }
}

run()
.then(() => {
  pgp.end()
  return process.exit(0)
})
.catch(e => {
  console.error(e)
  pgp.end()
  return process.exit(1)
})
