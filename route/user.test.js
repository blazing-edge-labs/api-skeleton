const _ = require('lodash')

const konst = require('konst')
const test = require('test')
const mailer = require('mail')

test.api('signin new', async function (t, request) {
  mailer.stub.enable()
  t.plan(6)

  let mailToken

  const { passwordlessLink } = mailer
  mailer.passwordlessLink = (token, email, originInfo) => {
    t.is(email, 'signin.new@example.com')
    mailToken = token
    return passwordlessLink(token, email, originInfo)
  }

  const r = await request.post('/signin').send({
    email: 'signin.new@example.com',
    allowNew: true,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')

  const r2 = await request.post('/auth/token').send({
    token: mailToken,
  })

  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
  mailer.passwordlessLink = passwordlessLink
  mailer.stub.restore()
})

test.api('signin existing', async function (t, request) {
  mailer.stub.enable()
  t.plan(6)

  let mailToken

  const { passwordlessLink } = mailer
  mailer.passwordlessLink = (token, email, originInfo) => {
    t.is(email, 'user1@example.com')
    mailToken = token
    return passwordlessLink(token, email, originInfo)
  }

  const r = await request.post('/signin').send({
    email: 'user1@example.com',
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')

  const r2 = await request.post('/auth/token').send({
    token: mailToken,
  })

  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
  mailer.passwordlessLink = passwordlessLink
  mailer.stub.restore()
})

test.api('signin not existing', async function (t, request) {
  mailer.stub.enable()
  t.plan(2)

  const { passwordlessLink } = mailer
  mailer.passwordlessLink = (token, email, originInfo) => {
    t.fail('passwordlessLink called')
    return passwordlessLink(token, email, originInfo)
  }

  const r = await request.post('/signin').send({
    email: 'not.existent@example.com',
  })
  t.is(r.status, 400, 'fail')
  t.ok(r.body.error, 'with error')

  mailer.passwordlessLink = passwordlessLink
  mailer.stub.restore()
})

test.api('signin superadmin', async function (t, request) {
  mailer.stub.enable()
  t.plan(6)

  let mailToken

  const { passwordlessLink } = mailer
  mailer.passwordlessLink = (token, email, originInfo) => {
    t.is(email, 'superadmin@example.com')
    mailToken = token
    return passwordlessLink(token, email, originInfo)
  }

  const r = await request.post('/signin').send({
    email: 'superadmin@example.com',
    minRole: konst.roleUser.superadmin,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')

  const r2 = await request.post('/auth/token').send({
    token: mailToken,
  })

  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
  mailer.passwordlessLink = passwordlessLink
  mailer.stub.restore()
})

test.api('signin with insufficient role', async function (t, request) {
  mailer.stub.enable()
  t.plan(2)

  const { passwordlessLink } = mailer
  mailer.passwordlessLink = (token, email, originInfo) => {
    t.fail('passwordlessLink called')
    return passwordlessLink(token, email, originInfo)
  }

  const r = await request.post('/signin').send({
    email: 'admin@example.com',
    minRole: konst.roleUser.superadmin,
  })
  t.is(r.status, 401, 'fail')
  t.ok(r.body.error, 'with error')

  mailer.passwordlessLink = passwordlessLink
  mailer.stub.restore()
})

test.api('auth', async function (t, request) {
  const r = await request.post('/auth').send({
    email: 'user1@example.com',
    password: 'user1',
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.ok(_.get(r.body, 'data.token'), 'token')
})

test.api('auth wrong password', async function (t, request) {
  const r = await request.post('/auth').send({
    email: 'user1@example.com',
    password: 'user2',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'user.password_wrong', 'error code')
})

test.api('auth with insufficient role', async function (t, request) {
  const r = await request.post('/auth').send({
    email: 'user1@example.com',
    password: 'user1',
    minRole: konst.roleUser.admin,
  })
  t.is(r.status, 401, 'fails')
  t.is(r.body.error, 'role.insufficient', 'error code')
})

test.api('self get', async function (t, request) {
  const r = await request.get('/self').set(await test.auth('user1@example.com', 'user1'))
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.is(_.get(r.body, 'data.email'), 'user1@example.com', 'email')
})

test.api('self update', async function (t, request) {
  const r = await request.put('/self').set(await test.auth('user1@example.com', 'user1'))
  t.is(r.status, 500, 'not implemented')
})

test.api('self add and change password', async function (t, request) {
  const r = await request.put('/self/password').set(await test.auth('user4@example.com')).send({
    newPassword: 'Password123',
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')

  const r2 = await request.put('/self/password').set(await test.auth('user4@example.com', 'Password123')).send({
    oldPassword: 'Password123',
    newPassword: 'Password1234',
  })
  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')

  const r3 = await request.post('/auth').send({
    email: 'user4@example.com',
    password: 'Password1234',
  })
  t.is(r3.status, 200, 'success')
  t.notok(r3.body.error, 'no error')
  t.ok(_.get(r3.body, 'data.token'), 'token')
})

test.api('self change password with wrong password', async function (t, request) {
  const r = await request.put('/self/password').set(await test.auth('user1@example.com', 'user1')).send({
    oldPassword: 'wrong password',
    newPassword: 'Password1234',
  })
  t.is(r.status, 400, 'wrong password')
  t.ok(r.body.error, 'with error')

  const r2 = await request.post('/auth').send({
    email: 'user1@example.com',
    password: 'user1',
  })
  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
})

test.api('self change email with disabled password', async function (t, request) {
  mailer.stub.enable()
  const r = await request.post('/signin').send({
    email: 'disabled.password.mail@example.com',
    allowNew: true,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')

  const r2 = await request.put('/self/email').set(await test.auth('disabled.password.mail@example.com')).send({
    email: 'disabled.password.mail2@example.com',
  })
  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  mailer.stub.restore()
})

test.api('self change email', async function (t, request) {
  const r = await request.put('/self/email').set(await test.auth('user3@example.com', 'user3')).send({
    password: 'user3',
    email: 'user3.1@example.com',
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')

  const r2 = await request.post('/auth').send({
    email: 'user3.1@example.com',
    password: 'user3',
  })
  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
})

test.api('self change email with wrong password', async function (t, request) {
  const r = await request.put('/self/email').set(await test.auth('user3.1@example.com', 'user3')).send({
    password: 'wrong password',
    email: 'user3.2@example.com',
  })
  t.is(r.status, 400, 'wrong password')
  t.ok(r.body.error, 'with error')

  const r2 = await request.post('/auth').send({
    email: 'user3.1@example.com',
    password: 'user3',
  })
  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
})

test.api('self role get', async function (t, request) {
  const r = await request.get('/self/role').set(await test.auth('user1@example.com', 'user1'))
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.deepEqual(r.body.data, {
    user: konst.roleUser.none,
    admin: false,
  })
})

test.api('password token nonexistant', async function (t, request) {
  const r = await request.post('/recoverPassword').send({
    email: 'nonexistant@example.com',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'user.not_found', 'error code')
})

test.api('password recover', async function (t, request) {
  mailer.stub.enable()
  t.plan(8)

  let r, token

  const { forgotPassword } = mailer

  mailer.forgotPassword = (email, passedToken) => {
    t.is(email, 'new@example.com')
    token = passedToken
    return forgotPassword(email, token)
  }

  r = await request.post('/signin').send({
    email: 'new@example.com',
    allowNew: true,
  })
  t.is(r.status, 200, 'success')

  r = await request.post('/recoverPassword').send({
    email: 'new@example.com',
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
    email: 'new@example.com',
    password: 'newnewnew',
  })
  t.is(r.status, 200, 'success')
  t.ok(_.get(r.body, 'data.token'), 'token')

  mailer.forgotPassword = forgotPassword
  mailer.stub.restore()
})

test.api('role put admin by superadmin', async function (t, request) {
  const id = _.get(await request.get('/user/email/user1@example.com').set(await test.auth('superadmin@example.com', 'superadmin')), 'body.data.id')
  const r = await request.put(`/user/${id}/role`).set(await test.auth('superadmin@example.com', 'superadmin')).send({
    role: konst.roleUser.admin,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
})

test.api('role put admin by admin', async function (t, request) {
  const id = _.get(await request.get('/user/email/user1@example.com').set(await test.auth('superadmin@example.com', 'superadmin')), 'body.data.id')
  const r = await request.put(`/user/${id}/role`).set(await test.auth('admin@example.com', 'admin')).send({
    role: konst.roleUser.admin,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
})

test.api('role put superadmin by admin', async function (t, request) {
  const id = _.get(await request.get('/user/email/user1@example.com').set(await test.auth('superadmin@example.com', 'superadmin')), 'body.data.id')
  const r = await request.put(`/user/${id}/role`).set(await test.auth('admin@example.com', 'admin')).send({
    role: konst.roleUser.superadmin,
  })
  t.is(r.status, 401, 'unauthorized')
  t.is(r.body.error, 'role.insufficient', 'error code')
})

test.api('role put none by admin', async function (t, request) {
  const id = _.get(await request.get('/user/email/user1@example.com').set(await test.auth('superadmin@example.com', 'superadmin')), 'body.data.id')
  const r = await request.put(`/user/${id}/role`).set(await test.auth('admin@example.com', 'admin')).send({
    role: konst.roleUser.none,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
})
