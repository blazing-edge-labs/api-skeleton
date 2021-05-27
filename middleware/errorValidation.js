const _ = require('lodash')

const docsLib = require('docs/api/lib')
const errors = require('error')

function errorValidation (errorConstants = []) {
  const _errorValidation = async function (ctx, next) {
    try {
      await next()
    } catch (err) {
      if (!(err instanceof errors.GenericError) || err.status >= 500) {
        throw err
      }

      const { error, status } = err
      if (_.some(errorConstants, { error, status })) {
        throw err
      }

      // TODO maybe this should be an internal error or validation one?
      throw errors('http.internal', err)
    }
  }
  _.set(_errorValidation, [docsLib.propSymbols.error], errorConstants)

  return _errorValidation
}

module.exports = errorValidation
