const _ = require('lodash')
const fsPromises = require('fs').promises
const path = require('path')

const app = require('app')
const docsLib = require('docs/api/lib')

const fetchRouter = middlewareArray =>
  _(middlewareArray)
  .filter(middleware => middleware.name === 'dispatch')
  .map(middleware => middleware.router)
  .first()

const docsConfiguration = {
  routers: fetchRouter(app.middleware),
}

async function createDocsJSON (docs) {
  return fsPromises.writeFile(
    path.join(__dirname, 'docs.json'),
    JSON.stringify(docs),
  )
}

/**
 * Bundle the docs into a JSON file for consumption
 */
async function createDocs (docsConfig) {
  const base = await docsLib.fetchBaseYaml()
  const extendedRouterDocs = await docsLib.fetchExtendedDocsForRoutes(docsConfig)
  const automaticRouteDocs = docsLib.generateDocsFromRoutes(
    docsConfig.routers,
    extendedRouterDocs,
  )

  const docs = _.merge({}, base, {
    info: {
      version: process.env.npm_package_version,
    },
    paths: _.merge({}, automaticRouteDocs, extendedRouterDocs),
  })

  return createDocsJSON(docs)
}

createDocs(docsConfiguration).catch(console.error)
