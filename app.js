const app = new (require('koa'))()
const mount = require('koa-mount')

app.silent = process.env.LOG < 3
app.use(require('koa-response-time')())
app.use(require('koa-conditional-get')())
app.use(require('koa-etag')())
app.use(require('koa-helmet')())
app.use(require('kcors')())
app.use(require('koa-bodyparser')())
app.use(require('middleware/error'))

app.use(mount('/', require('route/index').routes()))
app.use(mount('/', require('route/user').routes()))

app.use(async function (ctx, next) {
  ctx.throw(404)
  await next()
})

module.exports = app
