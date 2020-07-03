const { memoRef } = require('utils/data')

const defaultScheduler = job => Promise.resolve(job).then(process.nextTick)

function createBatcher (batchResolver, { batchMaxSize = Infinity, schedule = defaultScheduler, onFlush } = {}) {
  let qInputs = []
  let qResolvers = []

  const flush = () => {
    const inputs = qInputs
    const resolvers = qResolvers
    qInputs = []
    qResolvers = []

    if (onFlush) onFlush()

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

  return input => {
    qInputs.push(input)
    return new Promise(queueResolver)
  }
}

function createLoader (batchResolver, { batchMaxSize = 1000, schedule = defaultScheduler } = {}) {
  const cache = new Map()
  const batch = createBatcher(batchResolver, { batchMaxSize, schedule, onFlush: () => cache.clear() })
  return memoRef(batch, cache)
}

module.exports = {
  createBatcher,
  createLoader,
}
