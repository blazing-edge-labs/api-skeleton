const { Queue } = require('utils/data')

class Database {
  constructor (pool, opts) {
    this.pool = pool
    this._opts = opts
  }

  async query (query, values) {
    try {
      const { rows } = await this._runQuery(query, values)
      return rows
    } catch (e) {
      if (this._opts.queryErrorHandler) {
        this._opts.queryErrorHandler(e, query)
      }
      throw e
    }
  }

  task (fn) {
    return this._runTask(fn, false)
  }

  tx (fn) {
    return this._runTask(fn, true)
  }

  _runQuery (query, values) {
    return this.pool.query(query, values)
  }

  async _runTask (fn, isTx) {
    const task = new Task(this._opts, 0)
    const client = await this.pool.connect()
    try {
      return await task._run(client, fn, isTx)
    } finally {
      // Don't reuse the client if task failed to finish transaction!
      client.release(task._txLevel > 0)
    }
  }
}

class Task extends Database {
  constructor (opts, txLevel) {
    super(null, opts)
    this.client = null
    this._txLevel = txLevel
    this._queue = new Queue()
    this._pending = 0 // Number of pending queries or -1 when pending sub-task
    this._onAllDone = null

    this._next = () => {
      if (this._onAllDone && !this._pending) {
        this._onAllDone()
      }

      while (this._pending !== -1 && this._queue.size) {
        if (this._pending > 0 && this._queue.peek().exclusive) {
          break
        }

        const { resolve, method, args } = this._queue.shift()
        resolve(method.apply(this, args))
      }
    }
  }

  _pushMethodCall (method, ...args) {
    if (this._opts.debug) {
      method = bindAsyncCallStack(method, method)
    }
    return new Promise(resolve => {
      this._queue.push({ resolve, method, args, exclusive: this._pending > 0 })
    })
  }

  async _runQuery (query, values) {
    if (!this.client) {
      throw new Error('running query in finished task/tx')
    }
    if (this._pending === -1) {
      return this._pushMethodCall(this._runQuery, query, values)
    }

    ++this._pending
    try {
      return await this.client.query(query, values)
    } finally {
      if (--this._pending === 0) {
        process.nextTick(this._next)
      }
    }
  }

  async _runTask (fn, isTx) {
    if (!this.client) {
      throw new Error('running sub task/tx in finished task/tx')
    }
    if (this._pending) {
      return this._pushMethodCall(this._runTask, fn, isTx)
    }

    const task = new Task(this._opts, this._txLevel)
    this._pending = -1
    try {
      return await task._run(this.client, fn, isTx)
    } finally {
      this._pending = 0
      process.nextTick(this._next)
    }
  }

  _getTxQuery (topTxQuery, subTxQuery) {
    return this._txLevel === 1 ? topTxQuery : `${subTxQuery} sp${this._txLevel}`
  }

  async _run (client, fn, isTx = false) {
    let throwed = false

    if (isTx) {
      ++this._txLevel
      await client.query(this._getTxQuery('BEGIN', 'SAVEPOINT'))
    }

    this.client = client

    try {
      return await fn(this)
    } catch (e) {
      throwed = true
      throw e
    } finally {
      this.client = null

      if (this._queue.size) {
        const rejection = Promise.reject(new Error('task/tx aborted'))
        while (this._queue.size) this._queue.shift().resolve(rejection)
      }

      if (isTx) {
        // To ensure that queries are not leaked out, we wait for them to finish before the commit/rollback.
        if (this._pending) {
          await new Promise(resolve => {
            this._onAllDone = resolve
          })
        }
        await client.query(throwed
          ? this._getTxQuery('ROLLBACK', 'ROLLBACK TO SAVEPOINT')
          : this._getTxQuery('COMMIT', 'RELEASE SAVEPOINT'),
        )
        --this._txLevel
      }
    }
  }
}

function bindAsyncCallStack (fn, toFn, header = 'After:') {
  const fakeError = {}
  Error.captureStackTrace(fakeError, toFn || bindAsyncCallStack)

  return async function (...args) {
    try {
      return await fn.apply(this, args)
    } catch (e) {
      if (e instanceof Error) {
        Object.defineProperty(e, 'stack', {
          value: `${e.stack}\n${header}\n${fakeError.stack.replace(/^.*?\n/, '')}`,
          configurable: true,
        })
      }
      throw e
    }
  }
}

module.exports = {
  Database,
}
