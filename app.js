const app = new (require('koa'))()

app.silent = process.env.LOG < 3
app.use(require('koa-response-time')())
app.use(require('koa-conditional-get')())
app.use(require('koa-etag')())
app.use(require('koa-helmet')())
app.use(require('kcors')())
app.use(require('koa-bodyparser')())
app.use(require('middleware/error'))

app.use(require('route/index').routes())
app.use(require('route/user').routes())
app.use(require('route/superadmin').routes()) // Super-admin API endpoints

app.use(async function (ctx, next) {
  ctx.throw(404)
  await next()
})

module.exports = app
