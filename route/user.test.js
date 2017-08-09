const _ = require('lodash')

const consts = require('const')
const test = require('test')

test.api('register', async function (t, request) {
  const r = await request.post('/register').send({
    email: 'new@mail.com',
    password: 'newnewnew',
    name: 'user user',
    phone: '1111111111',
    zip: '99501',
    birthdate: '1991-05-19',
    gender: consts.gender.male,
    race: [consts.race.white],
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.ok(r.body.data, 'registered')
})

test.api('register phone taken', async function (t, request) {
  const r = await request.post('/register').send({
    email: 'newnew@mail.com',
    password: 'newnewnew',
    name: 'user user',
    phone: '1111111111',
    zip: '99501',
    birthdate: '1991-05-19',
    gender: consts.gender.male,
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'phone.duplicate')
})

test.api('register email taken', async function (t, request) {
  const r = await request.post('/register').send({
    email: 'new@mail.com',
    password: 'newnewnew',
    name: 'user user',
    phone: '1111111111',
    zip: '99501',
    birthdate: '1991-05-19',
    gender: consts.gender.male,
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'user.duplicate', 'error code')
})

test.api('auth', async function (t, request) {
  const r = await request.post('/auth').send({
    email: 'user1@mail.com',
    password: 'user1',
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.ok(_.get(r.body, 'data.token'), 'token')
})

test.api('auth wrong password', async function (t, request) {
  const r = await request.post('/auth').send({
    email: 'user1@mail.com',
    password: 'user2',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'user.password_wrong', 'error code')
})

test.api('self get', async function (t, request) {
  const r = await request.get('/self').set(await test.auth('user1@mail.com', 'user1'))
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.is(_.get(r.body, 'data.email'), 'user1@mail.com', 'email')
})

test.api('self put', async function (t, request) {
  const r = await request.put('/self').set(await test.auth('new@mail.com', 'newnewnew')).send({
    name: 'user updated',
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.is(_.get(r.body, 'data.name'), 'user updated', 'name updated')
})

test.api('self role get', async function (t, request) {
  const r = await request.get('/self/role').set(await test.auth('new@mail.com', 'newnewnew'))
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.deepEqual(r.body.data, {
    user: consts.roleUser.none,
    center: [],
    admin: false,
  })
})

test.api('password token nonexistant', async function (t, request) {
  const r = await request.post('/passwordtoken').send({
    email: 'nonexistant@mail.com',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'user.not_found', 'error code')
})

test.api('password change', async function (t, request) {
  let r

  r = await request.post('/passwordtoken').send({
    email: 'new@mail.com',
  })
  t.is(r.status, 200, 'success')
  const token = _.get(r.body, 'data.token')
  t.ok(token, 'token')

  r = await request.post('/passwordchange').send({
    password: 'newnewnew',
    token,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')

  r = await request.post('/auth').send({
    email: 'new@mail.com',
    password: 'newnewnew',
  })
  t.is(r.status, 200, 'success')
  t.ok(_.get(r.body, 'data.token'), 'token')
})

test.api('role put admin by superadmin', async function (t, request) {
  const id = _.get(await request.get('/user/email/user1@mail.com').set(await test.auth('superadmin@mail.com', 'superadmin')), 'body.data.id')
  const r = await request.put(`/user/${id}/role`).set(await test.auth('superadmin@mail.com', 'superadmin')).send({
    role: consts.roleUser.admin,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
})

test.api('role put admin by admin', async function (t, request) {
  const id = _.get(await request.get('/user/email/user1@mail.com').set(await test.auth('superadmin@mail.com', 'superadmin')), 'body.data.id')
  const r = await request.put(`/user/${id}/role`).set(await test.auth('admin@mail.com', 'admin')).send({
    role: consts.roleUser.admin,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
})

test.api('role put superadmin by admin', async function (t, request) {
  const id = _.get(await request.get('/user/email/user1@mail.com').set(await test.auth('superadmin@mail.com', 'superadmin')), 'body.data.id')
  const r = await request.put(`/user/${id}/role`).set(await test.auth('admin@mail.com', 'admin')).send({
    role: consts.roleUser.superadmin,
  })
  t.is(r.status, 401, 'unauthorized')
  t.is(r.body.error, 'role.insufficient', 'error code')
})

test.api('role put none by admin', async function (t, request) {
  const id = _.get(await request.get('/user/email/user1@mail.com').set(await test.auth('superadmin@mail.com', 'superadmin')), 'body.data.id')
  const r = await request.put(`/user/${id}/role`).set(await test.auth('admin@mail.com', 'admin')).send({
    role: consts.roleUser.none,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
})
