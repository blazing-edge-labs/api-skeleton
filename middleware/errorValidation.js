const _ = require('lodash')

const error = require('error')

function errorValidation (errorConstants = []) {
  return async function _errorValidation (ctx, next) {
    if (!next) {
      ctx.errorConstantObjs = errorConstants
      return
    }

    try {
      await next()
    } catch (err) {
      if (!(err instanceof error.GenericError) || err.status >= 500) {
        throw err
      }

      const {error, status} = err
      if (_.some(errorConstants, {error, status}) {
        throw err
      }

      // TODO maybe this should be an internal error or validation one?
      throw error('http.internal', err)
    }
  }
}

module.exports = errorValidation
