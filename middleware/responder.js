async function responder (ctx, next) {
  await next()

  ctx.assert(ctx.state.r, 500, 'using responder but did not set the response object on ctx.state.r')
  ctx.body = {
    status: true,
    code: 200,
    data: ctx.state.r,
  }
}

module.exports = responder
