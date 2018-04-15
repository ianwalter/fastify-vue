# fastify-vue
> [Vue.js](https://vuejs.org/) Server-Side Rendering (SSR)
  [Fastify](https://www.fastify.io/) plugin

```js
app.register(fastifyVueSsr, {
  templatePath: join(__dirname, 'server/index.html'),
  distPath: join(__dirname, 'dist'),
  clientConfig,
  serverConfig,
  webpack,
  createBundleRenderer,
  stats: { all: false, assets: true, colors: true }
})
```
