const joi = require('joi')
const router = new (require('koa-router'))()

const responder = require('middleware/responder')
const validate = require('middleware/validate')
const adminRepo = require('repo/superadmin')
const resources = adminRepo.resourceList

router.use(responder)

// Following routes are used for super-admin only (and currently don't utilize Auth middleware)
// [x] Todo: decide whether to extract these to a separate routes file (i.e. super-admin only routes) or not
// [x] Todo: see what could be abstracted to minimize repetition when introducing routes for other resources
// [ ] Todo: Add Auth middleware to routes after adding auth to super-admin FE

resources.forEach(resource => {
  router.get(`/${resource}`, validate('query', {
    sort: joi.array().items(joi.string()).length(2),
    page: joi.number(),
    perPage: joi.number(),
    filter: joi.object(),
  }), async function (ctx) {
    const {query} = ctx.v
    const count = await adminRepo[resource].getAllCount()
    ctx.state.r = {
      items: await adminRepo[resource].getAll(query),
      count: count[0].total,
    }
  })

  router.get(`/${resource}/:id`, validate('param', {
    id: joi.number().integer().positive().required(),
  }), async function (ctx) {
    const {id} = ctx.v.param
    ctx.state.r = await adminRepo[resource].getById(id)
  })

  router.del(`/${resource}/:id`, validate('param', {
    id: joi.number().integer().positive().required(),
  }), async function (ctx) {
    const {id} = ctx.v.param
    await adminRepo[resource].remove(id)
    ctx.state.r = {}
  })
})

module.exports = router
