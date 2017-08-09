const _ = require('lodash')
const _fp = require('lodash/fp')
const assert = require('assert')
const bcrypt = require('bcrypt')

const consts = require('const')
const error = require('error')
const {db, helper} = require('db')
const {mapper} = require('repo/base')

const map = mapper({
  birthdate: 'birthdate',
  createdAt: 'created_at',
  email: 'email',
  gender: 'gender',
  id: 'id',
  name: 'name',
  phone: 'phone',
  photoPermission: 'photo_permission',
  race: 'race',
  veteran: 'veteran',
})
const mapRoleCenter = mapper({
  centerId: 'center_id',
  role: 'role',
})

async function hashPassword (password) {
  return bcrypt.hash(password, _.toInteger(process.env.BCRYPT_ROUNDS))
  .catch(error.db('user.password_invalid'))
}

async function checkPassword (password, hash) {
  return bcrypt.compare(password, hash).then(assert)
  .catch(error.AssertionError, error('user.password_wrong'))
}

async function create (email, password, name, zip, phone, photoPermission, birthdate, veteran, gender, race) {
  return db.tx(async function (t) {
    return t.none(`
      INSERT INTO "user" (email, password) VALUES ($[email], $[password]);
      INSERT INTO
        user_info (user_id, name, zip, phone, photo_permission, birthdate, veteran, gender, race)
        VALUES (currval('user_id_seq'), $[name], $[zip], $[phone], $[photoPermission], $[birthdate], $[veteran], $[gender], $[race]);
      INSERT INTO
        user_role (user_id, role)
        VALUES (currval('user_id_seq'), $[role])
    `, {
      email,
      password: password ? await hashPassword(password) : '',
      name,
      zip,
      phone,
      photoPermission,
      birthdate,
      veteran,
      gender,
      race,
      role: consts.roleUser.none,
    })
    .catch({constraint: 'user_email_key'}, error('user.duplicate'))
    .catch({constraint: 'user_info_phone_key'}, error('phone.duplicate'))
  })
  .catch(error.db('db.write'))
}

async function updatePassword (id, password) {
  return db.none(`
    UPDATE "user"
    SET password = $2
    WHERE id = $1
  `, [id, await hashPassword(password)])
  .catch(error.db('db.update'))
}

async function updateById (id, name, zip, phone, photoPermission, birthdate, veteran, gender, race) {
  return db.none(helper.update(_.pickBy({
    name,
    zip,
    phone,
    photo_permission: photoPermission,
    birthdate,
    veteran,
    gender,
    race,
  }), null, 'user_info') + 'WHERE user_id = $1', [id])
  .catch({constraint: 'user_info_phone_key'}, error('phone.duplicate'))
  .catch(error.db('db.write'))
}

async function getById (id) {
  return db.one(`
    SELECT
      "user".*,
      user_info.*
    FROM "user"
    LEFT JOIN user_info ON "user".id = user_info.user_id
    WHERE "user".id = $1
  `, [id])
  .then(map)
  .catch(error.QueryResultError, error('user.not_found'))
  .catch(error.db('db.read'))
}

async function getByEmail (email) {
  return db.one(`
    SELECT
      "user".*,
      user_info.*
    FROM "user"
    LEFT JOIN user_info ON user_info.user_id = "user".id
    WHERE "user".email = $1
`, [email])
  .then(map)
  .catch(error.QueryResultError, error('user.not_found'))
  .catch(error.db('db.read'))
}

async function getByEmailPassword (email, password) {
  const user = await db.one(`
    SELECT id, password
    FROM "user"
    WHERE email = $1
  `, [email])
  .catch(error.QueryResultError, error('user.password_wrong'))
  .catch(error.db('db.read'))
  await checkPassword(password, user.password)
  return map(user)
}

async function getRoleById (id) {
  return db.one(`
    SELECT role
    FROM user_role
    WHERE user_id = $[id]
  `, {id})
  .catchReturn(error.QueryResultError, consts.roleUser.none)
  .get('role')
  .catch(error.db('db.read'))
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

async function getCenterRoleByIdCenterId (id, centerId) {
  return db.oneOrNone(`
    SELECT center_id, role
    FROM user_center_role
    WHERE
      user_id = $[id]
      AND center_id = $[centerId]
  `, {id, centerId})
  .then(function (centerRole) {
    return _.get(centerRole, 'role', consts.roleCenter.none)
  })
  .catch(error.db('db.read'))
}

async function setCenterRoleByIdCenterId (id, centerId, role) {
  return db.none(`
    INSERT INTO
      user_center_role (user_id, center_id, role)
      VALUES ($[id], $[centerId], $[role])
      ON CONFLICT ON CONSTRAINT user_center_role_pkey DO UPDATE SET role = $[role]
  `, {id, centerId, role})
  .catch({constraint: 'user_center_role_user_id_fkey'}, error.db('user.not_found'))
  .catch({constraint: 'user_center_role_center_id_fkey'}, error.db('center.not_found'))
  .catch(error.db('db.write'))
}

async function getCenterRolesById (id) {
  return db.any(`
    SELECT center_id, role
    FROM user_center_role
    WHERE user_id = $[id]
  `, {id})
  .map(mapRoleCenter)
  .catch(error.db('db.read'))
}

async function getPossibleInstructorsByCenterId (centerId) {
  const centerUserIds = await db.any(`
    SELECT user_id
    FROM user_center_role
    WHERE
      center_id = $[centerId]
      AND role >= $[role]
  `, {centerId, role: consts.roleCenter.instructor})
  .map(_fp.get('user_id'))
  .catch(error.db('db.read'))

  const adminUserIds = await db.any(`
    SELECT user_id
    FROM user_role
    WHERE role >= $[role]
  `, {role: consts.roleUser.admin})
  .map(_fp.get('user_id'))
  .catch(error.db('db.read'))

  return Promise.all(_.map(_.concat(centerUserIds, adminUserIds), getById))
}

module.exports = {
  create,
  getByEmail,
  getByEmailPassword,
  getById,
  getCenterRoleByIdCenterId,
  getCenterRolesById,
  getPossibleInstructorsByCenterId,
  getRoleById,
  map,
  setCenterRoleByIdCenterId,
  setRoleById,
  updateById,
  updatePassword,
}
