const _ = require('lodash')
const randomString = require('crypto-random-string')

const error = require('error')
const userRepo = require('repo/user')
const { db } = require('db')

async function create (userId) {
  await remove(userId)
  const { token } = await db.one(`
    INSERT INTO password_token (user_id, token)
    VALUES ($1, $2)
    RETURNING token
  `, [userId, randomString({ length: 32 })])
  return token
}

async function createById (userId) {
  await userRepo.getById(userId)
  return create(userId)
}

async function createByEmail (email) {
  const user = await userRepo.getByEmail(email)
  return create(user.id)
}

async function remove (userId) {
  return db.none('DELETE FROM password_token WHERE user_id = $1', [userId])
}

async function get (token) {
  const r = await db.one(`
    SELECT user_id
    FROM password_token
    WHERE
      token = $1
      AND created_at > now() - interval '$2 hour'
  `, [token, _.toInteger(process.env.PASSWORD_TOKEN_DURATION)])
  .catch(error.db({ noData: 'user.password_token_invalid' }))
  return r.user_id
}

module.exports = {
  createByEmail,
  createById,
  get,
  remove,
}
