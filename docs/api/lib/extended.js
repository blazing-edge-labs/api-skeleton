const _ = require('lodash')
const yaml = require('js-yaml')
const fsPromises = require('fs').promises
const path = require('path')

async function fetchBaseYaml () {
  const baseYaml = await fsPromises.readFile(
    path.join(__dirname, '..', 'base.yaml'),
  )
  return yaml.safeLoad(baseYaml)
}

async function fetchExtendedDocsForRoute (routePath) {
  try {
    const fullRoutePath = `${routePath}.yaml`
    const extendedDocsYaml = await fsPromises.readFile(fullRoutePath)
    return yaml.safeLoad(extendedDocsYaml)
  } catch (err) {
    if (!err.code === 'ENOENT') {
      console.error(err)
    }
  }
}

// // extended router docs (does not have to exist)
async function fetchExtendedDocsForRoutes (docsConfig) {
  const extendedRouteDocs = _.map(
    docsConfig.routeFileNames,
    routeFileName => {
      const routePath = path.join(__dirname, '..', docsConfig.docsRouteDir, routeFileName)
      return fetchExtendedDocsForRoute(routePath)
    },
  )

  const extendedRouteDocsObj = {}
  const extendedRouteDocsArray = _.compact(await Promise.all(extendedRouteDocs))

  // going through every file
  _.each(extendedRouteDocsArray, extendedRouteDoc => {
    // going through every path
    _.each(extendedRouteDoc, (extendedRouteMethods, extendedRoutePath) => {
      extendedRouteDocsObj[extendedRoutePath] = {}

      // going through every method
      _.each(extendedRouteMethods, (routeDocData, extendedRouteMethod) => {
        extendedRouteDocsObj[extendedRoutePath][extendedRouteMethod] = routeDocData
      })
    })
  })

  return extendedRouteDocsObj
}

module.exports = {
  fetchBaseYaml,
  fetchExtendedDocsForRoutes,
}
