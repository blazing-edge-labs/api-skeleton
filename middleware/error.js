const _ = require('lodash')

const error = require('error')

function wrap (err) {
  if (err instanceof error.GenericError) {
    return err
  }

  if (err.status === 401) {
    return error.http('http.unauthorized')(err)
  }

  if (err.status === 404) {
    return error.http('http.not_found')(err)
  }

  return error.http('http.internal')(err)
}

function status (err) {
  return _.get(err, 'status', 500)
}

function format (err) {
  if (err instanceof error.ValidationError) {
    return {
      status: false,
      code: err.code,
      error: err.error,
      errorv: err.details,
    }
  }

  if (err instanceof error.GenericError) {
    return {
      status: false,
      code: err.code,
      error: err.error,
      errorv: process.env.NODE_ENV === 'development' ? err.details : null,
    }
  }
}

module.exports = async function (ctx, next) {
  try {
    await next()
  } catch (e) {
    const err = wrap(e)
    ctx.status = status(err)
    ctx.body = format(err)
    ctx.app.emit('error', err, ctx)
  }
}
