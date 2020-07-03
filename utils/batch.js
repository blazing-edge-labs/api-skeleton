const { memoRef } = require('utils/data')

const defaultScheduler = job => Promise.resolve(job).then(process.nextTick)

function createBatcher (batchResolver, { batchMaxSize = Infinity, cache, autoClearCache = false, schedule = defaultScheduler } = {}) {
  let qInputs = []
  let qResolvers = []

  const flush = () => {
    const inputs = qInputs
    const resolvers = qResolvers
    qInputs = []
    qResolvers = []

    if (autoClearCache) cache.clear()

    if (inputs.length <= batchMaxSize) {
      processBatch(inputs, resolvers)
    } else {
      for (let i = 0; i < inputs.length; i += batchMaxSize) {
        processBatch(
          inputs.slice(i, i + batchMaxSize),
          resolvers.slice(i, i + batchMaxSize),
        )
      }
    }
  }

  const processBatch = async (inputs, resolvers) => {
    try {
      const results = await batchResolver(inputs)
      resolvers.forEach((resolve, i) => resolve(results[i]))
    } catch (error) {
      const rejection = Promise.reject(error)
      resolvers.forEach(resolve => resolve(rejection))
    }
  }

  const queueResolver = r => {
    if (qResolvers.push(r) === 1) schedule(flush)
  }

  const batch = input => {
    qInputs.push(input)
    return new Promise(queueResolver)
  }

  return cache
    ? memoRef(batch, cache)
    : batch
}

function createLoader (batchResolver, { batchMaxSize = 1000, cache = new Map(), autoClearCache = true, schedule = defaultScheduler } = {}) {
  return createBatcher(batchResolver, { batchMaxSize, cache, autoClearCache, schedule })
}

module.exports = {
  createBatcher,
  createLoader,
}
