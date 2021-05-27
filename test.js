const _ = require('lodash')
const assert = require('assert')
const jwt = require('jsonwebtoken')
const supertest = require('supertest')
const tape = require('tape')

const { db } = require('db')
const request = supertest(require('app').callback())
const userRepo = require('repo/user')

const cache = new Map()
const store = new Map()

tape.onFinish(async function () {
  await db.pool.end()
})

process.on('unhandledRejection', function (reason) {
  console.error('unhandled rejection', reason)
  process.exit(1)
})

function test () {
  const cb = _.last(arguments)
  tape(..._.initial(arguments), async function (t) {
    await cb(t, store)
    t.end()
  })
}

function testOnly () {
  const cb = _.last(arguments)
  tape.only(..._.initial(arguments), async function (t) {
    await cb(t, store)
    t.end()
  })
}

function api () {
  const cb = _.last(arguments)
  tape(..._.initial(arguments), async function (t) {
    await cb(t, request, store)
    t.end()
  })
}

function apiOnly () {
  const cb = _.last(arguments)
  tape.only(..._.initial(arguments), async function (t) {
    await cb(t, request, store)
    t.end()
  })
}

async function auth (email, password) {
  const key = `${email}-${password}`
  if (!cache.has(key)) {
    if (password) {
      const r = await request.post('/auth').send({ email, password })
      const { token } = r.body
      assert(token, 'error getting token in test auth helper')
      cache.set(key, token)
    } else {
      const { id: userId } = await userRepo.getByEmail(email)
      const token = jwt.sign({ id: userId }, process.env.JWT_SECRET)
      cache.set(key, token)
    }
  }
  return {
    Authorization: `Bearer ${cache.get(key)}`,
  }
}

test.auth = auth
test.api = api
test.api.skip = tape.skip
test.skip = tape.skip
test.skip.api = tape.skip
test.only = testOnly
test.only.api = apiOnly

module.exports = test
