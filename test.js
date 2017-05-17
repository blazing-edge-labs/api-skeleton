const _ = require('lodash')
const assert = require('assert')
const supertest = require('supertest')
const tape = require('tape')

const {pgp} = require('db')
const request = supertest(require('app').callback())

const cache = new Map()

tape.onFinish(async function () {
  await pgp.end()
})

process.on('unhandledRejection', function (reason) {
  console.error('unhandled rejection', reason)
  process.exit(1)
})

async function test () {
  const cb = _.last(arguments)
  tape(..._.initial(arguments), async function (t) {
    await cb(t)
    t.end()
  })
}

async function api () {
  const cb = _.last(arguments)
  tape(..._.initial(arguments), async function (t) {
    await cb(t, request)
    t.end()
  })
}

async function auth (email, password) {
  const key = `${email}-${password}`
  if (!cache.has(key)) {
    const r = await request.post('/auth').send({email, password})
    const token = _.get(r, 'body.data.token')
    assert(token, 'error getting token in test auth helper')
    cache.set(key, token)
  }
  return {
    'Authorization': `Bearer ${cache.get(key)}`,
  }
}

test.auth = auth
test.api = api
test.api.skip = tape.skip
test.skip = tape.skip
test.skip.api = tape.skip
test.fixture = require('fixture')

module.exports = test
