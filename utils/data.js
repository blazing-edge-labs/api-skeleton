const identity = x => x

class Queue {
  constructor () {
    this._arr = []
    this._i = 0
    this.size = 0
  }

  push (value) {
    this._arr.push(value)
    ++this.size
  }

  shift () {
    if (this.size === 0) return undefined

    const value = this._arr[this._i]
    this._arr[this._i] = undefined

    if (++this._i > --this.size) {
      this._arr = this._arr.slice(this._i)
      this._i = 0
    }

    return value
  }

  peek () {
    return this._arr[this._i]
  }
}

function memoRefIn (cache, fn) {
  return key => {
    let ref = cache.get(key)
    if (!ref) cache.set(key, (ref = fn(key)))
    return ref
  }
}

function memoArgs (fn) {
  const NONE = {}

  const root = {
    result: NONE,
    byVal: null,
    byRef: null,
  }

  return (...args) => {
    let node = root

    for (let i = 0; i < args.length; ++i) {
      const key = args[i]

      const cache = key === Object(key)
        ? node.byRef || (node.byRef = new WeakMap())
        : node.byVal || (node.byVal = new Map())

      node = cache.get(key)
      if (!node) {
        node = {
          result: NONE,
          byVal: null,
          byRef: null,
        }
        cache.set(key, node)
      }
    }

    if (node.result === NONE) {
      node.result = fn(...args)
    }

    return node.result
  }
}

const toFn = x => {
  if (x == null) {
    return identity
  }
  switch (typeof x) {
    case 'function':
      return x
    case 'string':
    case 'symbol':
      return z => z[x]
    default:
      throw new TypeError('invalid mapper type')
  }
}

function byKeyed (iterable, mapKey, mapValue, defValue) {
  mapKey = toFn(mapKey)
  mapValue = toFn(mapValue)

  const cache = new Map()

  for (const item of iterable) {
    cache.set(mapKey(item), mapValue(item))
  }

  return key => {
    const val = cache.get(key)
    return val === undefined ? defValue : val
  }
}

function byGrouped (iterable, mapKey, mapValue, defValue) {
  mapKey = toFn(mapKey)
  mapValue = toFn(mapValue)

  const cache = new Map()
  const getGroup = memoRefIn(cache, () => [])

  for (const item of iterable) {
    getGroup(mapKey(item)).push(mapValue(item))
  }

  return key => cache.get(key) || defValue
}

function * mapIterable (iterable, fn) {
  let i = 0
  for (const x of iterable) {
    yield fn(x, i++)
  }
}

module.exports = {
  Queue,
  identity,
  memoRefIn,
  memoArgs,
  byKeyed,
  byGrouped,
  mapIterable,
}
