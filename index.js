const fastifyPlugin = require('fastify-plugin')
const fastifyStatic = require('fastify-static')
const { readFileSync } = require('fs')
const { join } = require('path')
const MemoryFileSystem = require('memory-fs')
const webpack = require('webpack')

module.exports = fastifyPlugin(function (fastify, options, next) {
  const {
    serverConfig,
    clientConfig,
    distPath,
    templatePath,
    createBundleRenderer,
    stats,
    development
  } = options
  const { NODE_ENV } = process.env
  const isDevelopment = development || !NODE_ENV  || NODE_ENV === 'development'
  const bundlePath = join(distPath, 'vue-ssr-server-bundle.json')
  const template = readFileSync(templatePath, 'utf-8')
  const staticPath =  join(distPath, 'static')
  const manifestPath = join(staticPath, 'vue-ssr-client-manifest.json')

  // Declare the renderer on initialization so that it can be updated
  // independently of the request if necessary.
  let renderer
  if (isDevelopment) {
    const WebpackDevMiddleware = require('webpack-dev-middleware')
    let serverBundle
    let clientManifest
    let devMiddleware

    // Create renderer will update the renderer when the serverBundle or
    // clientManifest changes.
    function createRenderer () {
      renderer = createBundleRenderer(serverBundle, {
        runInNewContext: false,
        template,
        clientManifest
      })
    }

    // Create the serverCompiler using Webpack and the given Webpack server
    // configuration. Tell Webpack to use a memory filesystem to cut out
    // unnecessary writes/reads to the filesystem. Finally, instruct Webpack to
    // update the serverBundle and renderer when changes are detected.
    const serverCompiler = webpack(serverConfig)
    const mfs = new MemoryFileSystem()
    serverCompiler.outputFileSystem = mfs
    serverCompiler.watch({}, () => {
      serverBundle = JSON.parse(mfs.readFileSync(bundlePath))
      createRenderer()
    })

    // Modify the given client Webpack configuration to add the
    // WebpackHotMiddleware client code to be the first module in the client
    // bundle. Create the clientCompiler using Webpack and the given client
    // Webpack configuration. Add a plugin to the clientCompiler that updates
    // the clientManifest and renderer whenever the clientCompiler has finished
    // a compile run.
    clientConfig.entry = ['webpack-hot-middleware/client', clientConfig.entry]
    const clientCompiler = webpack(clientConfig)
    clientCompiler.plugin('done', () => {
      const { fileSystem } = devMiddleware
      clientManifest = JSON.parse(fileSystem.readFileSync(manifestPath))
      createRenderer()
    })

    // Create the WebpackDevMiddleware instance using the clientCompiler.
    // Configure it to use Fastify's log and the given stats configuration if
    // it's defined. Instruct fastify to use the WebpackDevMiddleware instance.
    devMiddleware = WebpackDevMiddleware(clientCompiler, {
      publicPath: clientConfig.output.publicPath,
      logger: fastify.log,
      ...(stats !== undefined ? { stats } : {})
    })
    fastify.use(devMiddleware)

    // Instruct fastify to use the WebpackHotMiddleware and to do a full
    // reload/refresh when the app can't be hot-reloaded.
    fastify.use(require('webpack-hot-middleware')(clientCompiler, {
      reload: true
    }))
  } else {
    // Use the fastify-static middleware to register a path that will be used
    // to serve static assets.
    fastify.register(fastifyStatic, { root: staticPath, prefix: '/static/' })

    //
    renderer = createBundleRenderer(require(bundlePath), {
      runInNewContext: false,
      template,
      clientManifest: require(manifestPath)
    })
  }

  fastify.get('*', async (request, reply) => {
    // Create the context object that will be used by the server entry to set
    // up the Vue.js application.
    const context = { url: request.req.url }

    // If the request is decorated with the csrfToken function via fastify-csrf
    // and the session is assigned to a User, generate a new CSRF token and add
    // it to the context so that it can be added to the store on server entry.
    if (request.csrfToken && request.session.userId) {
      context.csrfToken = request.csrfToken()
    }

    // Use the renderer to generate the HTML that will be sent to the client.
    try {
      const app = await renderer.renderToString(context)
      reply.type('text/html').send(app)
    } catch (error) {
      reply.send(error)
    }
  })

  // Continue after setup has completed.
  next()
})
