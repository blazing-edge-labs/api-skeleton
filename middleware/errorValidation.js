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
      if (err instanceof error.ValidationError || _.includes([401, 500], err.status)) {
        throw err
      }

      const isErrorDefinedInConstants = _.some(
        errorConstants,
        errorConstant => errorConstant.error === err.error,
      )
      if (isErrorDefinedInConstants) {
        throw err
      }

      // TODO maybe this should be an internal error or validation one?
      throw error('http.internal', err)
    }
  }
}

module.exports = errorValidation
