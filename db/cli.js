// should only be ran through package.json scripts

const argv = require('mri')(process.argv.slice(2), {
  boolean: true,
  stopEarly: true,
})
const migratio = require('migratio')

const { pgpDB: db, pgp } = require('db')

const command = argv._[0]

async function run () {
  switch (command) {
    case 'up':
    case 'down':
    case 'current':
      return migratio[command]({
        directory: 'db/migration',
        tableName: 'migration',
        verbose: true,
        revision: argv.r,
        db,
      })
    case 'drop':
      return db.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
    case 'seed': {
      const queryFile = new pgp.QueryFile('seed.sql')
      return db.tx(t => {
        return t.query(queryFile)
      })
    }
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
