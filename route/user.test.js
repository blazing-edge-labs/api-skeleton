const _fp = require('lodash/fp')

const test = require('test')

const pick = _fp.pick(['bio', 'firstName', 'lastName'])
const user = test.fixture.user.random

test.api('get user', async function (t, request) {
  const r = await request.get('/user')
    .set(await test.auth(user.email, user.password))
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.ok(r.body.data, 'registered user')
})

test.api('put user', async function (t, request) {
  const r = await request.put('/user')
    .set(await test.auth(user.email, user.password))
    .send(pick(user))
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.ok(r.body.data, 'returned updated user')
  t.same(pick(r.body.data), pick(user), 'user correctly updated')
})
