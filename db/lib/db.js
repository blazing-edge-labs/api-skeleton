const { Queue } = require('utils/data')

class QueryResultError extends Error {
  constructor (what, frame) {
    super(what)
    this.what = what
    this.code = QueryResultError.code[what]
    Error.captureStackTrace(this, frame || this.constructor)
  }
}

QueryResultError.code = {
  noData: 1,
  multiple: 2,
  notEmpty: 3,
}

class Database {
  constructor (pool, opts) {
    this.pool = pool
    this._opts = opts
  }

  async any (query, values) {
    const { rows } = await this._runQuery(query, values)
    return rows
  }

  async one (query, values) {
    const { rows } = await this._runQuery(query, values)
    if (rows.length === 0) throw new QueryResultError('noData')
    if (rows.length > 1) throw new QueryResultError('multiple')
    return rows[0]
  }

  async oneOrNone (query, values) {
    const { rows } = await this._runQuery(query, values)
    if (rows.length === 0) return null
    if (rows.length > 1) throw new QueryResultError('multiple')
    return rows[0]
  }

  async none (query, values) {
    const { rows } = await this._runQuery(query, values)
    if (rows.length > 0) throw new QueryResultError('notEmpty')
    return null
  }

  async many (query, values) {
    const { rows } = await this._runQuery(query, values)
    if (rows.length === 0) throw new QueryResultError('noData')
    return rows
  }

  async query (query, values) {
    const { rows } = await this._runQuery(query, values)
    return rows
  }

  result (query, values) {
    return this._runQuery(query, values)
  }

  task (fn) {
    return this._runTask(fn, false)
  }

  tx (fn) {
    return this._runTask(fn, true)
  }

  async _runQuery (query) {
    // console.log(`-----\n${query}\n-----`)
    try {
      return await this.pool.query(query)
    } catch (e) {
      if (this._opts.queryErrorHandler) {
        this._opts.queryErrorHandler(e, query)
      }
      throw e
    }
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

  async _runQuery (query) {
    if (!this.client) {
      throw new Error('running query in finished task/tx')
    }
    if (this._pending === -1) {
      return this._pushMethodCall(this._runQuery, query)
    }

    ++this._pending
    try {
      return await this.client.query(query)
    } catch (e) {
      if (this._opts.queryErrorHandler) {
        this._opts.queryErrorHandler(e, query)
      }
      throw e
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

  _startEndQuery (topTxQuery, subTxQuery) {
    return this._txLevel === 1 ? topTxQuery : `${subTxQuery} sp${this._txLevel}`
  }

  async _run (client, fn, isTx = false) {
    let throwed = false

    if (isTx) {
      ++this._txLevel
      await client.query(this._startEndQuery('BEGIN', 'SAVEPOINT'))
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
          ? this._startEndQuery('ROLLBACK', 'ROLLBACK TO SAVEPOINT')
          : this._startEndQuery('COMMIT', 'RELEASE SAVEPOINT'),
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
  QueryResultError,
}
