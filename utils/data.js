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

module.exports = {
  Queue,
}
