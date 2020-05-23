const fsPromises = require('fs').promises
const path = require('path')

const docsLib = require('docs/api/lib')

/**
 * update the all routers array to add new routes to swagger docs
 */
const allRouters = [
  require('route/index').routes(),
  require('route/user').routes(),
]

const base = {
  openapi: '3.0.0',
  servers: [
    {
      url: 'https://localhost:3000',
      description: 'Test server',
    },
  ],
  info: {
    version: process.env.npm_package_version,
    title: 'API Skeleton',
    description: 'This is the description',
  },
  paths: docsLib.generateDocsFromRoutes(allRouters),
  components: {
    securitySchemes: {
      jwt: {
        bearerFormat: 'JWT',
        scheme: 'Bearer',
        type: 'http',
      },
    },
  },
}

/**
 * Bundle the docs into a JSON file for consumption
 */
async function createDocs () {
  return fsPromises.writeFile(
    path.join(__dirname, 'docs.json'),
    JSON.stringify(base),
  )
}

createDocs().catch(console.error)
