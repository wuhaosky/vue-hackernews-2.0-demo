const fs = require('fs')
const path = require('path')
const LRU = require('lru-cache')   // https://github.com/isaacs/node-lru-cache  最少最近使用  其核心思想是“如果数据最近被访问过，那么将来被访问的几率也更高”  http://flychao88.iteye.com/blog/1977653
const express = require('express')
const favicon = require('serve-favicon')
const compression = require('compression') // https://github.com/expressjs/compression  
const resolve = file => path.resolve(__dirname, file)
const { createBundleRenderer } = require('vue-server-renderer')  // 通过vue-server-renderer包实现服务端渲染

const isProd = process.env.NODE_ENV === 'production'
const useMicroCache = process.env.MICRO_CACHE !== 'false'
const serverInfo =
  `express/${require('express/package.json').version} ` +
  `vue-server-renderer/${require('vue-server-renderer/package.json').version}`

const app = express()

const template = fs.readFileSync(resolve('./src/index.template.html'), 'utf-8')

function createRenderer (bundle, options) {
  // https://github.com/vuejs/vue/blob/dev/packages/vue-server-renderer/README.md#why-use-bundlerenderer
  return createBundleRenderer(bundle, Object.assign(options, {
    template,
    // for component caching
    cache: LRU({
      max: 1000,  //1000字节
      maxAge: 1000 * 60 * 15  // 15分钟缓存
    }),
    // this is only needed when vue-server-renderer is npm-linked
    basedir: resolve('./dist'),
    // recommended for performance
    runInNewContext: false
  }))
}

let renderer
let readyPromise
if (isProd) {
  // In production: create server renderer using built server bundle.
  // The server bundle is generated by vue-ssr-webpack-plugin.
  const bundle = require('./dist/vue-ssr-server-bundle.json')
  // The client manifests are optional, but it allows the renderer
  // to automatically infer preload/prefetch links and directly add <script>
  // tags for any async chunks used during render, avoiding waterfall requests.
  const clientManifest = require('./dist/vue-ssr-client-manifest.json')
  renderer = createRenderer(bundle, {
    clientManifest
  })
  // 除了 server bundle 之外，我们还可以生成客户端构建清单(client build manifest)。
  // 使用客户端清单(client manifest)和服务器 bundle(server bundle)，
  // renderer 现在具有了服务器和客户端的构建信息，因此它可以自动推断和注入资源预加载 / 数据预取指令(preload / prefetch directive)，以及 css 链接 / script 标签到所渲染的 HTML。
} else {
  // In development: setup the dev server with watch and hot-reload,
  // and create a new renderer on bundle / index template update.
  let setupDevServer = require('./build/setup-dev-server');
  readyPromise = setupDevServer(app, (bundle, options) => {
    renderer = createRenderer(bundle, options) // 在开发环境甚至部署过程中热重载（通过读取更新后的 bundle，然后重新创建 renderer 实例）
  })
}

const serve = (path, cache) => express.static(resolve(path), {
  maxAge: cache && isProd ? 1000 * 60 * 60 * 24 * 30 : 0
})

app.use(compression({ threshold: 0 }))
app.use(favicon('./public/logo-48.png'))
app.use('/dist', serve('./dist', true))
app.use('/public', serve('./public', true))
app.use('/manifest.json', serve('./manifest.json', true))
app.use('/service-worker.js', serve('./dist/service-worker.js'))

// 1-second microcache.
// https://www.nginx.com/blog/benefits-of-microcaching-nginx/
const microCache = LRU({
  max: 100,
  maxAge: 1000
})

// since this app has no user-specific content, every page is micro-cacheable.
// if your app involves user-specific content, you need to implement custom
// logic to determine whether a request is cacheable based on its url and
// headers.
const isCacheable = req => useMicroCache

function render (req, res) {
  const s = Date.now()

  res.setHeader("Content-Type", "text/html")
  res.setHeader("Server", serverInfo)

  const handleError = err => {
    if (err.url) {
      res.redirect(err.url)
    } else if(err.code === 404) {
      res.status(404).end('404 | Page Not Found')
    } else {
      // Render Error Page or Redirect
      res.status(500).end('500 | Internal Server Error')
      console.error(`error during render : ${req.url}`)
      console.error(err.stack)
    }
  }

  const cacheable = isCacheable(req)
  if (cacheable) {
    const hit = microCache.get(req.url)
    if (hit) {
      if (!isProd) {
        console.log(`cache hit!`)
      }
      return res.end(hit)
    }
  }

  const context = {
    title: 'Vue HN 2.0', // default title
    url: req.url
  }
  // 这里无需传入一个应用程序，因为在执行 bundle 时已经自动创建过。
  // bundle renderer 在调用 renderToString 时，它将自动执行「由 bundle 创建的应用程序实例」所导出的函数（传入上下文作为参数），然后渲染它。
  renderer.renderToString(context, (err, html) => {
    if (err) {
      return handleError(err)
    }
    res.end(html)
    if (cacheable) {
      microCache.set(req.url, html)
    }
    if (!isProd) {
      console.log(`whole request: ${Date.now() - s}ms`)
    }
  })
}

app.get('*', isProd ? render : (req, res) => {
  readyPromise.then(() => {
    render(req, res)
  })
})

const port = process.env.PORT || 8080
app.listen(port, () => {
  console.log(`server started at localhost:${port}`)
})
