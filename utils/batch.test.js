const _ = require('lodash')

const test = require('test')
const { delay } = require('utils/promise')
const { createLoader } = require('./batch')

test('createLoader', async t => {
  const resolverKeys = []

  const batchResolver = async (keys) => {
    resolverKeys.push(keys)
    await delay(50)
    return keys.map(x => -x)
  }

  const load = createLoader(batchResolver, { batchMaxSize: 5 })

  const inputs = [1, 2, 3, 4, 5, 6, 7, 2, 8, 9]
  const promises = inputs.map(load)

  t.is(promises.length, inputs.length)
  t.is(_.uniq(promises).length, _.uniq(inputs).length)
  t.ok(promises[1] === promises[7], 'for same key, loader returns same promise')
  t.ok(promises.every(p => Promise.resolve(p) === p), 'loader returns native promises')

  const results = await Promise.all(promises)

  t.deepEqual(resolverKeys, [[1, 2, 3, 4, 5], [6, 7, 8, 9]])
  t.deepEqual(results, [-1, -2, -3, -4, -5, -6, -7, -2, -8, -9])

  const promise1 = load(1)

  t.is(await promise1, -1)
  t.notOk(promise1 === promises[0], 'after resolving, cache is cleared (for same key, new promise is returned)')
})
