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
  const r = await db.one(`
    SELECT password
    FROM "user"
    WHERE id = $1
  `, [id])
  .catch(error.db({
    noData: 'user.not_found',
  }))
  if (!password && !r.password) return
  await checkPasswordWithHash(password, r.password)
}

async function create (email, password) {
  return db.tx(async function (t) {
    const user = await t.one(`
      INSERT INTO
        "user" (email, password)
        VALUES ($[email], $[password])
        RETURNING id
    `, {
      email,
      password: password ? await hashPassword(password) : null,
    })
    .catch(error.db({
      user_email_key: 'user.duplicate',
    }))

    await t.none(`
      INSERT INTO
        user_role (user_id, role)
        VALUES ($[id], $[role])
    `, {
      id: user.id,
      role: konst.roleUser.none,
    })
    .catch(error.db)

    return user
  })
}

async function updatePassword (id, password) {
  await db.none(`
    UPDATE "user"
    SET password = $2
    WHERE id = $1
  `, [id, await hashPassword(password)])
  .catch(error.db)
}

async function updateEmail (id, email) {
  return db.one(`
    UPDATE "user"
    SET email = $2
    WHERE id = $1
    RETURNING *
  `, [id, email])
  .catch(error.db({
    user_email_key: 'user.duplicate',
  }))
  .then(map)
}

async function getById (id) {
  return db.one(`
    SELECT *
    FROM "user"
    WHERE id = $1
  `, [id])
  .catch(error.db({ noData: 'user.not_found' }))
  .then(map)
}

async function getByIdPassword (id, password) {
  const rawUser = await db.one(`
    SELECT *
    FROM "user"
    WHERE id = $1
  `, [id])
  .catch(error.db({
    noData: 'user.not_found',
  }))
  await checkPasswordWithHash(password, rawUser.password)
  return map(rawUser)
}

async function getByEmail (email) {
  return db.one(`
    SELECT *
    FROM "user"
    WHERE email = $1
  `, [email])
  .catch(error.db({ noData: 'user.not_found' }))
  .then(map)
}

async function getByEmailSilent (email) {
  return db.oneOrNone(`
    SELECT *
    FROM "user"
    WHERE email = $1
  `, [email])
  .catch(error.db)
  .then(map)
}

async function getByEmailPassword (email, password) {
  const rawUser = await db.one(`
    SELECT *
    FROM "user"
    WHERE email = $1
  `, [email])
  .catch(error.db({
    noData: 'user.not_found',
  }))
  await checkPasswordWithHash(password, rawUser.password)
  return map(rawUser)
}

async function getRoleById (id) {
  const r = await db.oneOrNone(`
    SELECT role
    FROM user_role
    WHERE user_id = $[id]
  `, { id })
  .catch(error.db)

  return r ? r.role : konst.roleUser.none
}

async function setRoleById (id, role) {
  await db.one(`
    UPDATE user_role
    SET role = $[role]
    WHERE user_id = $[id]
    RETURNING *
  `, { id, role })
  .catch(error.db({
    noData: 'user.not_found',
  }))
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
