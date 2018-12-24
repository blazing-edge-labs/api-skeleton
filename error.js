const NestedError = require('nested-error-stacks')
const _ = require('lodash')
const assert = require('assert')
const { QueryFileError, QueryResultError, queryResultErrorCode } = require('pg-promise').errors

const errors = require('error.toml')

const inProduction = process.env.NODE_ENV === 'production'

// queryResultErrorCode
// - noData
// - multiple
// - notEmpty
const queryResultErrorName = _.invert(queryResultErrorCode)

function assertValidErrorConst (ec) {
  assert(_.get(errors, ec), `invalid error const: ${ec}`)
}

function assertValidDbErrorMappingKey (key) {
  assert(key in queryResultErrorCode || key.includes('_'), `invalid db error mapping key: ${key}`)
}

class GenericError extends NestedError {
  constructor (ec, cause, status) {
    assertValidErrorConst(ec)
    super(ec, cause)
    this.error = ec
    this.code = ec
    this.status = status
  }
}

class DatabaseError extends GenericError {}
class HttpError extends GenericError {}
class ValidationError extends GenericError {}

function error (ec, cause, status) {
  if (ec.startsWith('http.')) return new HttpError(ec, cause, status || _.get(errors, ec) || 500)
  if (ec.startsWith('db.')) return new DatabaseError(ec, cause, status || 500)
  if (ec.endsWith('.not_found')) return new GenericError(ec, cause, status || 404)
  return new GenericError(ec, cause, status || 400)
}

error.db = (mapping = {}) => {
  if (mapping instanceof DatabaseError) {
    throw mapping
  }
  if (mapping instanceof Error) {
    throw error('db.internal', mapping)
  }

  if (!inProduction) {
    _.keys(mapping).forEach(assertValidDbErrorMappingKey)
    _.values(mapping).filter(_.isString).forEach(assertValidErrorConst)
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

error.errors = errors

error.AssertionError = assert.AssertionError
error.DatabaseError = DatabaseError
error.GenericError = GenericError
error.HttpError = HttpError
error.QueryFileError = QueryFileError
error.QueryResultError = QueryResultError
error.ValidationError = ValidationError

module.exports = error
