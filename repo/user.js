const _ = require('lodash')
const assert = require('assert')
const bcrypt = require('bcrypt')

const error = require('error')
const {db, helper} = require('db')
const {mapper} = require('repo/base')

const map = mapper({
  bio: 'bio',
  confirmed: v => !!v.confirmed,
  createdAt: 'created_at',
  email: 'email',
  firstName: 'first_name',
  id: 'id',
  lastName: 'last_name',
})

async function create (email, password, firstName, lastName, bio) {
  const hash = await bcrypt.hash(password, _.toInteger(process.env.BCRYPT_ROUNDS)).catch(error('user.invalid_password'))
  return db.none(helper.insert({
    email: email,
    password: hash,
    first_name: firstName || '',
    last_name: lastName || '',
    bio: bio || '',
  }, null, 'user')).catch(error.db('user.write'))
}

async function getByEmailPassword (email, password) {
  const user = await db.one(`
    SELECT *
    FROM "user"
    WHERE email = $1
  `, [email]).catch(error.QueryResultError, error('user.wrong_password'))
  await bcrypt.compare(password, user.password).then(assert).catch(error.AssertionError, error('user.wrong_password'))
  return map(user)
}

async function getByEmail (email) {
  return db.one(`
    SELECT *
    FROM "user"
    WHERE email = $1
  `, [email]).then(map).catch(error.QueryResultError, error('user.not_found'))
}

async function getById (id) {
  return db.one(`
    SELECT *
    FROM "user"
    WHERE id = $1
  `, [_.toInteger(id)]).then(map).catch(error.QueryResultError, error('user.not_found'))
}

async function ensureEmailNotTaken (email) {
  return db.none(`
    SELECT *
    FROM "user"
    WHERE email = $1
  `, [email]).catch(error.QueryResultError, error('user.duplicate'))
}

async function updateById (id, firstName, lastName, bio) {
  return db.none(`
    UPDATE "user"
    SET
      first_name = $2,
      last_name = $3,
      bio = $4
    WHERE id = $1
  `, [_.toInteger(id), firstName, lastName, bio]).catch(error.QueryResultError, error('user.update'))
}

module.exports = {
  create,
  ensureEmailNotTaken,
  getByEmail,
  getByEmailPassword,
  getById,
  updateById,
}
