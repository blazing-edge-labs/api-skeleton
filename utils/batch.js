const { memoRefIn } = require('utils/data')

const defaultScheduler = job => Promise.resolve(job).then(process.nextTick)

function createLoader (resolveKeys, { mapKey, batchMaxSize = 1000, cache = new Map(), autoClearCache = !!cache, schedule = defaultScheduler } = {}) {
  let queued = []
  let nextKey

  const flush = () => {
    const batch = queued
    queued = []

    if (autoClearCache) {
      cache.clear()
    }

    if (batch.length <= batchMaxSize) {
      processBatch(batch)
    } else {
      for (let i = 0; i < batch.length; i += batchMaxSize) {
        processBatch(batch.slice(i, i + batchMaxSize))
      }
    }
  }

  const processBatch = async (batch) => {
    try {
      const results = await resolveKeys(batch.map(it => it.key))
      batch.forEach((it, i) => it.resolve(results[i]))
    } catch (error) {
      const rejection = Promise.reject(error)
      batch.forEach(it => it.resolve(rejection))
    }
  }

  const pushResolver = resolve => {
    if (queued.push({ key: nextKey, resolve }) === 1) {
      schedule(flush)
    }
    nextKey = undefined
  }

  const batch = key => {
    nextKey = key
    return new Promise(pushResolver)
  }

  const addKey = cache
    ? memoRefIn(cache, batch)
    : batch

  return mapKey
    ? key => addKey(mapKey(key))
    : addKey
}

module.exports = {
  createLoader,
}
