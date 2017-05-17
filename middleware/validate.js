const _ = require('lodash')
const joi = require('joi')

const error = require('error')

const defaults = {
  abortEarly: false,
  allowUnknown: false,
  convert: true,
}

function validate (field, schema, options = {}) {
  const opts = _.defaults(options, defaults)
  const schemaCompiled = joi.compile(schema)

  return async function (ctx, next) {
    const r = schemaCompiled.validate(ctx.request[field], opts)
    if (r.error) {
      throw error.validation('http.bad_request', {
        [field]: r.error.details,
      }, 400)(r.error)
    }

    ctx.request[`v${field}`] = _.assign({}, ctx.request[`v${field}`], r.value)
    await next()
  }
}

module.exports = validate
