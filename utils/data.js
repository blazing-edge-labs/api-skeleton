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

function memoRef (fn, cache = new WeakMap()) {
  return key => {
    let ref = cache.get(key)
    if (!ref) cache.set(key, (ref = fn(key)))
    return ref
  }
}

function byKeyed (iterable, mapKey, mapValue = identity) {
  const m = new Map()

  for (const item of iterable) {
    m.set(mapKey(item), mapValue(item))
  }

  return key => {
    const value = m.get(key)
    return value == null ? null : value
  }
}

function byGrouped (iterable, mapKey, mapValue = identity) {
  const getGroup = memoRef(() => [], new Map())

  for (const item of iterable) {
    getGroup(mapKey(item)).push(mapValue(item))
  }

  return getGroup
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
  memoRef,
  byKeyed,
  byGrouped,
  mapIterable,
}
