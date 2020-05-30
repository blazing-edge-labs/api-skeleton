const _ = require('lodash')
const fsPromises = require('fs').promises
const path = require('path')

const docsLib = require('docs/api/lib')

const docsConfiguration = {
  // location of the routes
  routeDir: 'route',
  // location of the route extended docs
  docsRouteDir: 'route',
  /**
   * Automatic docs will add these files and combine with the extended docs
   * If you want to use subdirs in the "route" folder then add the paths as arrays
   * e.g. "route/user/friends"
   *
   * routeFilePaths: [ ['user', 'friends'] ]
   */
  routeFilePaths: [
    'index',
    'user',
  ],
}

// automatic router docs
function requireRoutes (docsConfig) {
  return _.map(docsConfig.routeFilePaths, routeFilePath => {
    return require(`${docsConfig.routeDir}/${routeFilePath}`).routes()
  })
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
    requireRoutes(docsConfig),
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
