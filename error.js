const NestedError = require('nested-error-stacks')
const _ = require('lodash')
const assert = require('assert')
const { QueryFileError, QueryResultError, queryResultErrorCode } = require('pg-promise').errors

const errors = require('error.toml')

const inProduction = process.env.NODE_ENV === 'production'

// queryResultErrorCode:
//   noData: int
//   multiple: int
//   notEmpty: int
const queryResultErrorName = _.invert(queryResultErrorCode)

function getCode (ec) {
  const code = _.get(errors, ec)
  if (!code) throw new TypeError(`invalid error const: ${ec}`)
  return code
}

function checkDBErrorMappingKey (key) {
  if (!key.includes('_') && !(key in queryResultErrorCode)) {
    throw new TypeError(`invalid dbErrorHandler mapping key: ${key}`)
  }
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
  if (mapping instanceof DatabaseError) {
    throw mapping
  }
  if (mapping instanceof Error) {
    throw error('db.internal', mapping)
  }

  if (!inProduction) {
    _.keys(mapping).forEach(checkDBErrorMappingKey)
    _.values(mapping).filter(_.isString).forEach(getCode)
  }

  return cause => {
    if (cause instanceof DatabaseError) {
      throw cause
    }

    const key = cause instanceof QueryResultError
      ? queryResultErrorName[cause.code]
      : cause.constraint

    const handle = key && mapping[key]

    if (_.isFunction(handle)) {
      return handle(cause)
    }

    throw error(handle || 'db.internal', cause)
  }
}

error.db = dbErrorHandler
error.errors = errors

error.AssertionError = assert.AssertionError
error.DatabaseError = DatabaseError
error.GenericError = GenericError
error.HttpError = HttpError
error.QueryFileError = QueryFileError
error.QueryResultError = QueryResultError
error.ValidationError = ValidationError

module.exports = error
