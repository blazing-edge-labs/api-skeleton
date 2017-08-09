const test = require('test')
const fixture = require('fixture')

const user = fixture.user.random

test.api('register', async function (t, request) {
  const r = await request.post('/register').send({
    email: user.email,
    password: user.password,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.ok(r.body.data, 'registered user')
})

test.api('auth', async function (t, request) {
  const r = await request.post('/auth').send({
    email: user.email,
    password: user.password,
  })
  t.is(r.status, 200, 'success')
  t.notok(r.body.error, 'no error')
  t.ok(r.body.data, 'returned token')
})
