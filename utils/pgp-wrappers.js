/**
 * Database and Task classes to wrap respective PGP's ones
 * with the main goal to make running queries and sub-transactions
 * concurrently not broken. In particular, the Task class auto
 * queues query/tx calls to ensure queries do not leak in and out
 * of save-points.
 * Additionally, wrappers provide query error customization
 * via a `queryErrorHandler` option.
 *
 * NOTE: Wrappers do NOT replicate exactly PGP's API,
 * leaving out some features/methods that we consider
 * not important or even dangerous.
 */
const { as, queryResult } = require('pg-promise')
const { Queue } = require('queue')

const noop = () => {}

function defaultQueryErrorHandler (err) {
  throw err
}

function wrapDatabase (db, { queryErrorHandler = defaultQueryErrorHandler } = {}) {
  return new Database(db, { queryErrorHandler })
}

class Database {
  constructor (db, opts) {
    this._t = db
    this._opts = opts
  }

  wrapTask (t) {
    return new Task(t, this._opts)
  }

  query (query, values, qrm = queryResult.any) {
    return this._t.query(query, values, qrm).catch(this._opts.queryErrorHandler)
  }

  stream (qs, initCB) {
    return this._t.stream(qs, initCB).catch(this._opts.queryErrorHandler)
  }

  tx (cb) {
    return this._t.tx(t => new Task(t, this._opts).run(cb))
  }

  task (cb) {
    return this._t.task(t => new Task(t, this._opts).run(cb))
  }

  none (query, values) {
    return this.query(query, values, queryResult.none)
  }

  one (query, values) {
    return this.query(query, values, queryResult.one)
  }

  oneOrNone (query, values) {
    return this.query(query, values, queryResult.one | queryResult.none)
  }

  many (query, values) {
    return this.query(query, values, queryResult.many)
  }

  manyOrNone (query, values) {
    return this.query(query, values, queryResult.many | queryResult.none)
  }

  any (query, values) {
    return this.query(query, values, queryResult.any)
  }
}

class Task extends Database {
  constructor (t, opts) {
    super(t, opts)
    this._queue = new Queue()
    this._runningQueries = 0
    this._runningTx = false
    this._running = false
    this._onAllDone = noop

    this._next = () => {
      if (!this._running && !this._runningQueries && !this._runningTx) {
        this._onAllDone()
        return
      }

      while (!this._runningTx && this._queue.size) {
        if (this._runningQueries && this._queue.peek().method === this._runTx) {
          break
        }

        const { resolve, method, args } = this._queue.shift()
        resolve(method.apply(this, args))
      }
    }
  }

  _queueMethodCall (method, ...args) {
    return new Promise(resolve => {
      this._queue.push({ resolve, method, args })
    })
  }

  async _runQuery (query, qrm) {
    ++this._runningQueries
    try {
      return await this._t.query(query, undefined, qrm)
    } catch (e) {
      this._opts.queryErrorHandler(e)
    } finally {
      if (--this._runningQueries === 0) {
        process.nextTick(this._next)
      }
    }
  }

  async _runQueryStream (qs, initCB) {
    ++this._runningQueries
    try {
      return await this._t.stream(qs, initCB)
    } catch (e) {
      this._opts.queryErrorHandler(e)
    } finally {
      if (--this._runningQueries === 0) {
        process.nextTick(this._next)
      }
    }
  }

  async _runTx (cb) {
    this._runningTx = true
    try {
      return await this._t.tx(t => new Task(t, this._opts).run(cb))
    } finally {
      this._runningTx = false
      process.nextTick(this._next)
    }
  }

  query (query, values, qrm = queryResult.any) {
    if (!this._running) {
      throw new Error('running query on finished task/tx')
    }
    if (values != null) {
      query = as.format(query, values)
    }
    if (this._runningTx) {
      return this._queueMethodCall(this._runQuery, query, qrm)
    }
    return this._runQuery(query, qrm)
  }

  stream (qs, initCB) {
    if (!this._running) {
      throw new Error('running query stream on finished task/tx')
    }
    if (this._runningTx) {
      return this._queueMethodCall(this._runQueryStream, qs, initCB)
    }
    return this._runQueryStream(qs, initCB)
  }

  tx (fn) {
    if (!this._running) {
      throw new Error('running tx on finished task/tx')
    }
    if (this._runningTx || this._runningQueries) {
      return this._queueMethodCall(this._runTx, fn)
    }
    return this._runTx(fn)
  }

  // Already in a task (using same connection), so we can reuse the same one.
  task (fn) {
    // For consistency, we ensure fn is called in next microtask.
    return Promise.resolve(this).then(fn)
  }

  async run (fn) {
    if (this._running || !this._t) {
      throw new Error('task can be ran only once')
    }
    this._running = true
    try {
      return await fn(this)
    } finally {
      const { level } = this._t.ctx
      this._running = false
      this._t = null

      if (this._queue.size) {
        const rejection = Promise.reject(new Error('task/tx aborted'))
        while (this._queue.size) this._queue.shift().resolve(rejection)
      }

      // To ensure that queries are not leaked out, we wait for them to finish before the commit/rollback.
      if (level > 0 && (this._runningQueries || this._runningTx)) {
        await new Promise(resolve => {
          this._onAllDone = resolve
        })
      }
    }
  }
}

module.exports = {
  wrapDatabase,
}
