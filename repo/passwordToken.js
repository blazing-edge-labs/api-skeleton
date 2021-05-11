const _ = require('lodash')
const randomString = require('crypto-random-string')

const error = require('error')
const userRepo = require('repo/user')
const { db } = require('db')

async function create (userId) {
  await remove(userId)
  const [{ token }] = await db.sql`
    INSERT INTO password_token (user_id, token)
    VALUES (${userId}, ${randomString({ length: 32 })})
    RETURNING token
  `
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
  return db.sql`DELETE FROM password_token WHERE user_id = ${userId}`
}

async function get (token) {
  const hoursDur = _.toInteger(process.env.PASSWORD_TOKEN_DURATION)

  const [row] = await db.sql`
    SELECT user_id
    FROM password_token
    WHERE
      token = ${token}
      AND created_at > now() - interval '${hoursDur} hour'
  `

  if (!row) throw error('user.password_token_invalid')

  return row.user_id
}

module.exports = {
  createByEmail,
  createById,
  get,
  remove,
}
