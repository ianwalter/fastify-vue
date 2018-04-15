const fastifyPlugin = require('fastify-plugin')
const fastifyStatic = require('fastify-static')
const { readFileSync } = require('fs')
const { join } = require('path')
const MemoryFileSystem = require('memory-fs')

module.exports = fastifyPlugin(function (fastify, options, next) {
  const {
    serverConfig,
    clientConfig,
    distPath,
    templatePath,
    createBundleRenderer,
    webpack,
    stats
  } = options
  const isProduction = process.env.NODE_ENV === 'production'
  const bundlePath = join(distPath, 'vue-ssr-server-bundle.json')
  const template = readFileSync(templatePath, 'utf-8')
  const staticPath =  join(distPath, 'static')
  const manifestPath = join(staticPath, 'vue-ssr-client-manifest.json')

  let renderer
  if (isProduction) {
    //
    fastify.register(fastifyStatic, { root: staticPath, prefix: '/static/' })

    //
    renderer = createBundleRenderer(require(bundlePath), {
      runInNewContext: false,
      template,
      clientManifest: require(manifestPath)
    })
  } else {
    const WebpackDevMiddleware = require('webpack-dev-middleware')
    let serverBundle
    let clientManifest

    function createRenderer () {
      renderer = createBundleRenderer(serverBundle, {
        runInNewContext: false,
        template,
        clientManifest
      })
    }

    //
    const serverCompiler = webpack(serverConfig)
    const mfs = new MemoryFileSystem()
    serverCompiler.outputFileSystem = mfs
    serverCompiler.watch({}, () => {
      serverBundle = JSON.parse(mfs.readFileSync(bundlePath))
      createRenderer()
    })

    //
    clientConfig.entry = ['webpack-hot-middleware/client', clientConfig.entry]
    const clientCompiler = webpack(clientConfig)
    clientCompiler.plugin('done', () => {
      const { fileSystem } = devMiddleware
      clientManifest = JSON.parse(fileSystem.readFileSync(manifestPath))
      createRenderer()
    })

    //
    const devMiddleware = WebpackDevMiddleware(clientCompiler, {
      publicPath: clientConfig.output.publicPath,
      logger: fastify.log,
      ...(stats !== undefined ? { stats } : {})
    })
    fastify.use(devMiddleware)

    // TODO
    // process.on('SIGTERM', () => devMiddleware.close())

    //
    fastify.use(require('webpack-hot-middleware')(clientCompiler))
  }

  fastify.get('*', async ({ req }, reply) => {
    try {
      const app = await renderer.renderToString({ url: req.url })
      reply.type('text/html').send(app)
    } catch (error) {
      reply.send(error)
    }
  })

  next()
})
