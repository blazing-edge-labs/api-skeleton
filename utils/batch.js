const defaultScheduler = job => Promise.resolve(job).then(process.nextTick)

function createLoader (
  resolveKeys,
  {
    batchMaxSize = 1000,
    cache = new Map(),
    autoClearCache = true,
    schedule = defaultScheduler,
  } = {},
) {
  let queued = []
  let tmpKey

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

  const push = resolve => {
    queued.push({ key: tmpKey, resolve })
    tmpKey = undefined
  }

  return key => {
    let p = cache.get(key)
    if (!p) {
      tmpKey = key
      p = new Promise(push)
      cache.set(key, p)
      if (queued.length === 1) {
        schedule(flush)
      }
    }
    return p
  }
}

module.exports = {
  createLoader,
}
