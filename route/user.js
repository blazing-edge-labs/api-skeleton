const joi = require('joi')
const router = new (require('koa-router'))()

const auth = require('middleware/auth')
const responder = require('middleware/responder')
const validate = require('middleware/validate')
const userRepo = require('repo/user')

router.use(auth)
router.use(responder)

router.get('/user', async function (ctx) {
  ctx.state.r = await userRepo.getById(ctx.state.user.id)
})

router.put('/user', validate('body', {
  firstName: joi.string().trim().optional(),
  lastName: joi.string().trim().optional(),
  bio: joi.string().trim().optional(),
}), async function (ctx) {
  const {firstName, lastName, bio} = ctx.request.body
  await userRepo.updateById(ctx.state.user.id, firstName, lastName, bio)
  ctx.state.r = await userRepo.getById(ctx.state.user.id)
})

module.exports = router
