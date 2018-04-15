# fastify-vue
> [Vue.js](https://vuejs.org/) Server-Side Rendering (SSR)
  [Fastify](https://www.fastify.io/) plugin

```js
const fastifyVue = require('fastify-vue')
const webpack = require('webpack')
const { createBundleRenderer } = require('vue-server-renderer')

app.register(fastifyVue, {
  templatePath: join(__dirname, 'server/index.html'),
  distPath: join(__dirname, 'dist'),
  clientConfig,
  serverConfig,
  webpack,
  createBundleRenderer,
  stats: { all: false, assets: true, colors: true }
})
```
