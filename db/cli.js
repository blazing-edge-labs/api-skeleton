// should only be ran through package.json scripts

const fs = require('fs')
const { migrate } = require('postgres-migrations')
const { db } = require('db')

async function run (command) {
  switch (command) {
    case 'migrate':
      return db.task(({ client }) => migrate({ client }, 'db/migration'))
    case 'drop':
      return db.sql`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`
    case 'seed': {
      const text = fs.readFileSync('db/seed.sql', 'utf8')
      return db.tx(t => t.query({ text }))
    }
    default:
      throw new Error(`"${command}" is not a valid migration command`)
  }
}

run(...process.argv.slice(2))
.then(() => {
  db.pool.end()
  return process.exit(0)
})
.catch(e => {
  console.error(e)
  db.pool.end()
  return process.exit(1)
})
