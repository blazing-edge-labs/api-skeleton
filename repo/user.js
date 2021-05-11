const bcrypt = require('bcryptjs')

const konst = require('konst')
const error = require('error')
const { db, helper } = require('db')
const { mapper } = require('repo/base')

const map = mapper({
  id: 'id',
  createdAt: 'created_at',
  email: 'email',
  hasPassword: (r) => !!r.password,
})

const columnSet = new helper.ColumnSet([
  'email',
], { table: 'user' })

async function hashPassword (password) {
  return bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS))
}

async function checkPasswordWithHash (password, hash) {
  if (!password || !hash || !await bcrypt.compare(password, hash)) {
    throw error('user.password_wrong')
  }
}

async function checkPassword (id, password) {
  const [row] = await db.sql`
    SELECT password
    FROM "user"
    WHERE id = ${id}
  `
  if (!row) throw error('user.not_found')
  if (!password && !row.password) return
  await checkPasswordWithHash(password, row.password)
}

async function create (email, password) {
  const hashedPassword = password ? await hashPassword(password) : null

  return db.tx(async function (t) {
    const [user] = await t.sql`
      INSERT INTO "user" (email, password)
      VALUES (${email}, ${hashedPassword})
      RETURNING id
    `
    .catch(error.db({
      user_email_key: 'user.duplicate',
    }))

    await t.sql`
      INSERT INTO user_role (user_id, role)
      VALUES (${user.id}, ${konst.roleUser.none})
    `

    return user
  })
}

async function updatePassword (id, password) {
  await db.sql`
    UPDATE "user"
    SET password = ${await hashPassword(password)}
    WHERE id = ${id}
  `
}

async function updateEmail (id, email) {
  const [user] = await db.sql`
    UPDATE "user"
    SET email = ${email}
    WHERE id = ${id}
    RETURNING *
  `
  .catch(error.db({
    user_email_key: 'user.duplicate',
  }))
  .then(map)

  return user
}

async function getById (id) {
  const [user] = await db.sql`
    SELECT *
    FROM "user"
    WHERE id = ${id}
  `
  .then(map)

  if (!user) throw error('user.not_found')
  return user
}

async function getByIdPassword (id, password) {
  const rawUser = await db.one`
    SELECT *
    FROM "user"
    WHERE id = ${id}
  `

  if (!rawUser) throw error('user.not_found')
  await checkPasswordWithHash(password, rawUser.password)
  return map(rawUser)
}

async function getByEmail (email) {
  const [user] = await db.sql`
    SELECT *
    FROM "user"
    WHERE email = ${email}
  `
  .then(map)

  if (!user) throw error('user.not_found')
  return user
}

async function getByEmailSilent (email) {
  const [user] = await db.sql`
    SELECT *
    FROM "user"
    WHERE email = ${email}
  `
  .then(map)

  return user
}

async function getByEmailPassword (email, password) {
  const [rawUser] = await db.sql`
    SELECT *
    FROM "user"
    WHERE email = ${email}
  `

  if (!rawUser) throw error('user.not_found')
  await checkPasswordWithHash(password, rawUser.password)
  return map(rawUser)
}

async function getRoleById (id) {
  const [row] = await db.sql`
    SELECT role
    FROM user_role
    WHERE user_id = ${id}
  `
  return row ? row.role : konst.roleUser.none
}

async function setRoleById (id, role) {
  const [row] = await db.sql`
    UPDATE user_role
    SET role = ${role}
    WHERE user_id = ${id}
    RETURNING *
  `
  if (!row) throw error('user.not_found')
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
