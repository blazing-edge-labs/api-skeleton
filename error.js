const NestedError = require('nested-error-stacks')
const _ = require('lodash')
const assert = require('assert')

const toml = require('utils/toml')

const errors = toml.parseFile('error.toml')

const inProduction = process.env.NODE_ENV === 'production'

function getCode (ec) {
  const code = _.get(errors, ec)
  if (!code) throw new TypeError(`invalid error const: ${ec}`)
  return code
}

class GenericError extends NestedError {
  constructor (ec, cause, status) {
    super(ec, cause)
    this.error = ec
    this.code = getCode(ec)
    this.status = status
  }
}

class DatabaseError extends GenericError {}
class HttpError extends GenericError {}
class ValidationError extends GenericError {}

function error (ec, cause, status) {
  if (ec.startsWith('db.')) {
    return new DatabaseError(ec, cause, status || 500)
  }

  if (!status) {
    const ecParts = ec.split('.')
    status = errors.http[_.last(ecParts)]
  }

  if (ec.startsWith('http.')) {
    return new HttpError(ec, cause, status)
  }

  return new GenericError(ec, cause, status || 400)
}

function dbErrorHandler (mapping = {}) {
  if (!inProduction) {
    _.values(mapping).forEach(getCode)
  }

  return err => {
    let cause = err
    while (cause instanceof DatabaseError) cause = cause.nested

    const key = cause.constraint

    const handle = key && mapping[key]

    if (!handle) throw err

    if (typeof handle === 'function') {
      return handle(cause)
    }

    throw error(handle, cause)
  }
}

error.db = dbErrorHandler
error.errors = errors

error.AssertionError = assert.AssertionError
error.DatabaseError = DatabaseError
error.GenericError = GenericError
error.HttpError = HttpError
error.ValidationError = ValidationError

module.exports = error
