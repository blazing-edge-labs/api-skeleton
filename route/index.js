const router = new (require('koa-router'))()

const responder = require('middleware/responder')

router.use(responder)

router.get('/health', async function (ctx) {
  ctx.state.r = true
})

module.exports = router
