const { memoRefIn } = require('utils/data')

const defaultScheduler = job => Promise.resolve(job).then(process.nextTick)

function createLoader (batchResolver, { batchMaxSize = 1000, cache = new Map(), autoClearCache = !!cache, schedule = defaultScheduler } = {}) {
  let queued = []

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
      const results = await batchResolver(batch.map(it => it.key))
      batch.forEach((it, i) => it.resolve(results[i]))
    } catch (error) {
      const rejection = Promise.reject(error)
      batch.forEach(it => it.resolve(rejection))
    }
  }

  const batch = key => {
    return new Promise(resolve => {
      if (queued.push({ key, resolve }) === 1) {
        schedule(flush)
      }
    })
  }

  return cache
    ? memoRefIn(cache, batch)
    : batch
}

module.exports = {
  createLoader,
}
