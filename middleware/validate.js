const _ = require('lodash')
const joi = require('joi')

const error = require('error')

const defaults = {
  abortEarly: false,
  allowUnknown: false,
  convert: true,
}

const path = {
  body: 'request.body',
  header: 'request.header',
  param: 'params',
  query: 'request.query',
}

function validate (target, schema, options = {}) {
  const opts = _.defaults(options, defaults)
  const schemaCompiled = joi.compile(schema)

  return async function (ctx, next) {
    const input = _.get(ctx, path[target])
    ctx.assert(input, 400)

    const {error: err, value: data} = schemaCompiled.validate(input, opts)
    if (err) {
      err.target = target
      throw error.validation('http.bad_request', 400)(err)
    }

    _.set(ctx, `v.${target}`, _.assign({}, _.get(ctx, `v.${target}`), data))
    await next()
  }
}

module.exports = validate
