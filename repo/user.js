const _ = require('lodash')
const assert = require('assert')
const bcrypt = require('bcrypt')

const consts = require('const')
const error = require('error')
const {db, helper} = require('db')
const {mapper} = require('repo/base')

const map = mapper({
  id: 'id',
  createdAt: 'created_at',
  email: 'email',
  hasPassword: (r) => !!r.password,
})

const columnSet = new helper.ColumnSet([
  'email',
], {table: 'user'})

async function hashPassword (password) {
  return bcrypt.hash(password, _.toInteger(process.env.BCRYPT_ROUNDS))
  .catch(error.db('user.password_invalid'))
}

async function checkPasswordWithHash (password, hash) {
  password = password || 'null'
  hash = hash || 'null'
  return bcrypt.compare(password, hash).then(assert)
  .catch(error.AssertionError, error('user.password_wrong'))
}

async function checkPassword (id, password) {
  const r = await db.one(`
    SELECT password
    FROM "user"
    WHERE id = $1
  `, [id])
  .catch(error.QueryResultError, error('user.not_found'))
  .catch(error.db('db.read'))
  if (!password && !r.password) return
  await checkPasswordWithHash(password, r.password)
}

async function create (email, password) {
  return db.tx(async function (t) {
    return t.one(`
      INSERT INTO
        "user" (email, password)
        VALUES ($[email], $[password])
        RETURNING id;
      INSERT INTO
        user_role (user_id, role)
        VALUES (currval('user_id_seq'), $[role])
    `, {
      email,
      password: password ? await hashPassword(password) : null,
      role: consts.roleUser.none,
    })
    .catch({constraint: 'user_email_key'}, error('user.duplicate'))
  })
  .catch(error.db('db.write'))
}

async function updatePassword (id, password) {
  await db.none(`
    UPDATE "user"
    SET password = $2
    WHERE id = $1
  `, [id, await hashPassword(password)])
  .catch(error.db('db.update'))
}

async function updateEmail (id, email) {
  return db.one(`
    UPDATE "user"
    SET email = $2
    WHERE id = $1
    RETURNING *
  `, [id, email])
  .catch({constraint: 'user_email_key'}, error('user.duplicate'))
  .catch(error.db('db.write'))
  .then(map)
}

async function getById (id) {
  return db.one(`
    SELECT *
    FROM "user"
    WHERE id = $1
  `, [id])
  .then(map)
  .catch(error.QueryResultError, error('user.not_found'))
  .catch(error.db('db.read'))
}

async function getByIdPassword (id, password) {
  const user = await db.one(`
    SELECT *
    FROM "user"
    WHERE id = $1
  `, [id])
  .catch(error.QueryResultError, error('user.not_found'))
  .catch(error.db('db.read'))
  await checkPasswordWithHash(password, user.password)
  return map(user)
}

async function getByEmail (email) {
  return db.one(`
    SELECT *
    FROM "user"
    WHERE email = $1
  `, [email])
  .catch(error.QueryResultError, error('user.not_found'))
  .catch(error.db('db.read'))
  .then(map)
}

async function getByEmailSilent (email) {
  return db.oneOrNone(`
    SELECT *
    FROM "user"
    WHERE email = $1
  `, [email])
  .catch(error.db('db.read'))
  .then((r) => r ? map(r) : null)
}

async function getByEmailPassword (email, password) {
  const user = await db.one(`
    SELECT *
    FROM "user"
    WHERE email = $1
  `, [email])
  .catch(error.QueryResultError, error('user.password_wrong'))
  .catch(error.db('db.read'))
  await checkPasswordWithHash(password, user.password)
  return map(user)
}

async function getRoleById (id) {
  return db.one(`
    SELECT role
    FROM user_role
    WHERE user_id = $[id]
  `, {id})
  .catchReturn(error.QueryResultError, consts.roleUser.none)
  .catch(error.db('db.read'))
  .get('role')
}

async function setRoleById (id, role) {
  return db.none(`
    UPDATE user_role
    SET role = $[role]
    WHERE user_id = $[id]
  `, {id, role})
  .catch({constraint: 'user_role_user_id_fkey'}, error.db('user.not_found'))
  .catch(error.db('db.write'))
}

module.exports = {
  create,
  checkPassword,
  updatePassword,
  updateEmail,
  getByEmail,
  getByEmailSilent,
  getByEmailPassword,
  getById,
  getByIdPassword,
  getRoleById,
  map,
  columnSet,
  setRoleById,
}
