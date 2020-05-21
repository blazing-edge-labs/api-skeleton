const _ = require('lodash')
const joi = require('@hapi/joi')
const router = new (require('koa-router'))()

// const adminRepo = require('repo/superadmin')
// const auth = require('middleware/auth')
// const konst = require('konst')
// const resources = adminRepo.resourceList
const responder = require('middleware/responder')
// const roleUser = require('middleware/roleUser')
const validate = require('middleware/validate')
const errorValidation = require('middleware/errorValidation')

router.use(responder)

// const photoPost = {
//   // route path
//   path: '/photos',
//   // route method
//   method: 'post',
//   // swagger meta fields
//   meta: {

//   },
//   // error responses from route
//   errors: {
//     constants: [],
//     custom: {},
//   },
//   // validation schemas
//   validation: {
//     body: {
//       name: joi.string().trim().required(),
//       id: joi.number().integer().required(),
//       meta: joi.object().keys({
//         size: joi.number().integer().required(),
//         location: joi.string().optional(),
//         lat: joi.number().precision(5).optional(),
//         lng: joi.number().precision(5).optional(),
//       }).optional(),
//     }
//   },
//   auth: {
//     type: '',
//     // handler: middleware,
//   },
//   // route middleware
//   middleware: [
//     async function (ctx) {
//       ctx.state.r = [{
//         name: 'some photo',
//       }]
//     }
//   ]
// }

// const validationMiddleware = _.map(photoPost.validation, (schema, section) => validate[section](schema))
// router[photoPost.method](photoPost.path, ...validationMiddleware, ...photoPost.middleware)

// function getArgs (args) {
//   console.log('arguments', args)
// }

// console.log(router.routes().router.stack[1].stack[0](getArgs))

// console.log(router.routes().router.stack[1])

// module.exports = {
//   routeDocs: {
//     photoPost,
//   },
//   router,
// }

const photoErrors = [{
  error: 'photo.not_found',
}]

router.get('/photo', validate.query({
  limit: joi.number().integer().description('Ovo je opis za limit').optional(),
}), errorValidation([
  'photo.not_found'
]), async function (ctx) {
  ctx.state.r = [{
    name: 'asdasd'
  }]
})

router.post('/photo', validate.body({
  name: joi.string().trim().description('This is the name of the photo').required(),
}), async function (ctx) {
  ctx.state.r = {
    name: 'some photo info'
  }
})

module.exports = router