const _ = require('lodash')

const consts = require('const')
const test = require('test')
const mailer = require('utils/mailer')

test.api('register', async function (t, request) {
  const r = await request.post('/register').send({
    email: 'new@mail.com',
    password: 'newnewnew',
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.ok(r.body.data, 'registered')
})

test.api('register email taken', async function (t, request) {
  const r = await request.post('/register').send({
    email: 'new@mail.com',
    password: 'newnewnew',
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

test.api('self update', async function (t, request) {
  const r = await request.put('/self').set(await test.auth('user1@mail.com', 'user1'))
  t.is(r.status, 500, 'not implemented')
})

test.api('self change password', async function (t, request) {
  const r = await request.put('/self/password').set(await test.auth('user1@mail.com', 'user1')).send({
    oldPassword: 'user1',
    newPassword: 'Password123',
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')

  const r2 = await request.post('/auth').send({
    email: 'user1@mail.com',
    password: 'Password123',
  })
  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
})

test.api('self change password with wrong password', async function (t, request) {
  const r = await request.put('/self/password').set(await test.auth('user1@mail.com', 'Password123')).send({
    oldPassword: 'wrong password',
    newPassword: 'Password1234',
  })
  t.is(r.status, 400, 'wrong password')
  t.ok(r.body.error, 'with error')

  const r2 = await request.post('/auth').send({
    email: 'user1@mail.com',
    password: 'Password123',
  })
  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
})

test.api('self change email', async function (t, request) {
  const r = await request.put('/self/email').set(await test.auth('user3@mail.com', 'user3')).send({
    password: 'user3',
    email: 'user3.1@mail.com',
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')

  const r2 = await request.post('/auth').send({
    email: 'user3.1@mail.com',
    password: 'user3',
  })
  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
})

test.api('self change email with wrong password', async function (t, request) {
  const r = await request.put('/self/email').set(await test.auth('user3.1@mail.com', 'user3')).send({
    password: 'wrong password',
    email: 'user3.2@mail.com',
  })
  t.is(r.status, 400, 'wrong password')
  t.ok(r.body.error, 'with error')

  const r2 = await request.post('/auth').send({
    email: 'user3.1@mail.com',
    password: 'user3',
  })
  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
})

test.api('self role get', async function (t, request) {
  const r = await request.get('/self/role').set(await test.auth('new@mail.com', 'newnewnew'))
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.deepEqual(r.body.data, {
    user: consts.roleUser.none,
    admin: false,
  })
})

test.api('password token nonexistant', async function (t, request) {
  const r = await request.post('/recoverPassword').send({
    email: 'nonexistant@mail.com',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'user.not_found', 'error code')
})

test.api('password recover', async function (t, request) {
  t.plan(7)

  let r, token

  const { forgotPassword } = mailer

  mailer.forgotPassword = (email, passedToken) => {
    t.is(email, 'new@mail.com')
    token = passedToken
    return forgotPassword(email, token)
  }

  r = await request.post('/recoverPassword').send({
    email: 'new@mail.com',
  })
  t.is(r.status, 200, 'success')

  t.ok(token, 'token')

  r = await request.post('/changePassword').send({
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

  mailer.forgotPassword = forgotPassword
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
