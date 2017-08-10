const _ = require('lodash')

const error = require('error')

function wrap (err) {
  if (err instanceof error.GenericError) {
    return err
  }

  if (err.status === 400) {
    return error.http('http.bad_request', 400)(err, true)
  }

  if (err.status === 401) {
    return error.http('http.unauthorized', 401)(err, true)
  }

  if (err.status === 404) {
    return error.http('http.not_found', 404)(err, true)
  }

  return error.http('http.internal')(err, true)
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
      errorv: {
        [err.nested.target]: err.nested.details,
      },
    }
  }

  if (err instanceof error.GenericError) {
    return {
      status: false,
      code: err.code,
      error: err.error,
      errorv: process.env.NODE_ENV === 'development' ? err.nested : null,
    }
  }
}

function log (err) {
  if (process.env.LOG > 0 && err instanceof error.DatabaseError) {
    console.error(err.nested)
  } else if (process.env.LOG > 0 && err instanceof error.HttpError) {
    console.error(err.nested)
  } else if (err instanceof error.ValidationError) {
    // do nothing
  } else if (process.env.LOG > 1) {
    console.error(err.nested)
  }
}

module.exports = async function (ctx, next) {
  try {
    await next()
  } catch (e) {
    const err = wrap(e)
    log(err)
    ctx.status = status(err)
    ctx.body = format(err)
    ctx.app.emit('error', err, ctx)
  }
}
