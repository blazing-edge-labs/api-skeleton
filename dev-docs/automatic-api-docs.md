# Automatic API documentation

Documenting APIs on time tight projects is the first thing to be hindered. It's usually left as a TODO or just forgoten, when changing a piece of code that is already documented. The small lib in `docs/api/lib` should help generate a base level documentation from joi so at least all routes and the consumable properties are displayed in an easier fashion.

### How it works?
The developer writes yaml documentation for the API and the lib adds the routes along with any validations and specific error handling. All of the routes and errors will be read from the route middlewares and added to the paths object to bundle the complete documentation.

There are three main sections in the documentation:
1. Base general app information - this is the general information of the API (version, summary, security being used...). The general information is added to the `docs/api/base.yaml` file
2. Route documentation (paths) - these are all the routes in the application. This part should be generated automatically, by adding the route file names into the `docsConfiguration` object in `docs/api/index.js`
3. Extended documentation - this is any additional information you would like to add to your routes. For example additional responses and/or summary data that the route may have.

All three sections are combined into a `docs/api/docs.json` file, which uses swagger. Basically you can add the docs to any swagger editor that supports OpenAPI 3.0.0 and it will display properly.

### Writing docs
Will add this to...


### Serving the docs
We are using redoc-cli to build and serve the `index.html` file, which will be served at the `/docs` route. If you want to build the docs for production or deployed environments, then use:
```bash
yarn docs:build:bundle
```
This will run the `docs:build` command to compile the route and *extended* documentation and bundle everything into an `index.html` file. In order to show the documentation you need to set the `SERVE_DOCS` environment variable to true.