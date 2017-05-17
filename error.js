const _ = require('lodash')
const assert = require('assert')
const ExtendableError = require('es6-error')
const pgp = require('pg-promise')

const errors = require('error.toml')

class GenericError extends ExtendableError {
  constructor (ec, details, status) {
    super(ec)
    this.error = ec
    this.code = code(ec)
    this.details = details
    this.status = status
  }
}

class DatabaseError extends GenericError {}
class HttpError extends GenericError {}
class ValidationError extends GenericError {}

function code (ec) {
  const code = _.get(errors, ec)
  assert(code, 'invalid error const specified')
  return code
}

function wrapper (ErrorClass) {
  return function (ec, details, status = 500) {
    return function handler (err) {
      if (process.env.LOG > 0 && ErrorClass === DatabaseError) {
        console.error(err)
      } else if (process.env.LOG > 0 && ErrorClass === HttpError) {
        console.error(err)
      } else if (ErrorClass === ValidationError) {
        // do nothing
      } else if (process.env.LOG > 1) {
        console.error(err)
      }

      throw new ErrorClass(ec, details || err.details || err.message, status)
    }
  }
}

const error = wrapper(GenericError)
error.db = wrapper(DatabaseError)
error.http = wrapper(HttpError)
error.validation = wrapper(ValidationError)

error.errors = errors

error.AssertionError = assert.AssertionError
error.DatabaseError = DatabaseError
error.GenericError = GenericError
error.HttpError = HttpError
error.QueryFileError = pgp.errors.QueryFileError
error.QueryResultError = pgp.errors.QueryResultError
error.ValidationError = ValidationError

module.exports = error
