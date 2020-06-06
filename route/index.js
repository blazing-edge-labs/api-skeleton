const router = new (require('koa-router'))()

router.get('/health', async function (ctx) {
  ctx.body = 'OK'
})

module.exports = router
