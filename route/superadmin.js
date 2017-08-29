const joi = require('joi')
const router = new (require('koa-router'))()

const responder = require('middleware/responder')
const validate = require('middleware/validate')

const userRepo = require('repo/user')

router.use(responder)

// Following routes are used for super-admin only (and currently don't utilize Auth middleware)
// [x] Todo: decide whether to extract these to a separate routes file (i.e. super-admin only routes) or not
// [ ] Todo: see what could be abstracted to minimize repetition when introducing routes for other resources
router.get('/users', validate('query', {
  sort: joi.array().items(joi.string()).length(2),
  page: joi.number(),
  perPage: joi.number(),
  filter: joi.object(),
}), async function (ctx) {
  const {query} = ctx.v
  const count = await userRepo.getAllCount()
  ctx.state.r = {
    items: await userRepo.getAll(query),
    count: count[0].total,
  }
})

router.get('/users/:id', validate('param', {
  id: joi.number().integer().positive().required(),
}), async function (ctx) {
  const {id} = ctx.v.param
  ctx.state.r = await userRepo.getById(id)
})

module.exports = router
