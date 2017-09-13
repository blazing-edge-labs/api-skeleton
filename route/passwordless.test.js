const _ = require('lodash')

const test = require('test')
const mailer = require('utils/mailer')

test.api('passwordless attempt success', async function (t, request) {
  mailer.stub.enable()
  const r = await request.post('/passwordless/attempt').send({
    email: 'user1@example.com',
    originInfo: 'mobile',
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.ok(_.get(r.body, 'data.tokenDirect'), 'token')
  mailer.stub.restore()
})

test.api('passwordless attempt failure user not found', async function (t, request) {
  mailer.stub.enable()
  const r = await request.post('/passwordless/attempt').send({
    email: 'not.found@example.com',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'user.not_found', 'error code')
  mailer.stub.restore()
})

test.api('passwordless confirm success', async function (t, request) {
  mailer.stub.enable()
  t.plan(4)

  let tokenRemote, tokenDirect

  const {passwordlessLink} = mailer
  mailer.passwordlessLink = (token, email, originInfo) => {
    t.is(email, 'superadmin@example.com')
    tokenRemote = token
    return passwordlessLink(token, email, originInfo)
  }

  const r = await request.post('/passwordless/attempt').send({
    email: 'superadmin@example.com',
  })
  tokenDirect = _.get(r.body, 'data.tokenDirect')

  const r2 = await request.post('/passwordless/confirm').send({
    tokenRemote,
    tokenDirect,
  })
  t.is(r2.status, 200, 'success')
  t.notok(r2.body.error, 'no error')
  t.ok(_.get(r2.body, 'data.token'), 'token')
  mailer.passwordlessLink = passwordlessLink
  mailer.stub.restore()
})

test.api('passwordless confirm fail not found', async function (t, request) {
  const r = await request.post('/passwordless/confirm').send({
    tokenRemote: '00000000-0000-4000-8000-000000000000',
    tokenDirect: '00000000-0000-4000-8000-000000000000',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'passwordless.not_found', 'error code')
})

test.api('passwordless confirm fail valid tokens but wrong pair', async function (t, request) {
  const r = await request.post('/passwordless/confirm').send({
    tokenRemote: '11111111-0000-4000-8000-000000000001',
    tokenDirect: '11111111-0000-4000-8000-000000000002',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'passwordless.token_mismatch', 'error code')
})

test.api('passwordless confirm fail invalid remote', async function (t, request) {
  const r = await request.post('/passwordless/confirm').send({
    tokenRemote: '00000000-0000-4000-8000-000000000000',
    tokenDirect: '11111111-0000-4000-8000-000000000001',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'passwordless.wrong_link', 'error code')
})

test.api('passwordless confirm fail invalid direct', async function (t, request) {
  const r = await request.post('/passwordless/confirm').send({
    tokenRemote: '11111111-0000-4000-8000-000000000001',
    tokenDirect: '00000000-0000-4000-8000-000000000000',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'passwordless.wrong_origin', 'error code')
})

test.api('passwordless confirm fail expired', async function (t, request) {
  const r = await request.post('/passwordless/confirm').send({
    tokenRemote: '11111111-0000-4000-8000-000000000000',
    tokenDirect: '11111111-0000-4000-8000-000000000000',
  })
  t.is(r.status, 400, 'bad request')
  t.is(r.body.error, 'passwordless.expired', 'error code')
})
