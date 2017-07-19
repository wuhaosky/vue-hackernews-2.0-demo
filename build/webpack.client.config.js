const glob = require("glob");
const webpack = require("webpack");
const merge = require("webpack-merge");
const base = require("./webpack.base.config");
const SWPrecachePlugin = require("sw-precache-webpack-plugin");
const VueSSRClientPlugin = require("vue-server-renderer/client-plugin");

const config = merge(base, {
    entry: {
        app: "./src/entry-client.js"
    },
    resolve: {
        alias: {
            "create-api": "./create-api-client.js"
        }
    },
    plugins: [
        // strip dev-only code in Vue source
        new webpack.DefinePlugin({
            "process.env.NODE_ENV": JSON.stringify(
                process.env.NODE_ENV || "development"
            ),
            "process.env.VUE_ENV": '"client"'
        }),
        // extract vendor chunks for better caching
        // 给 minChunks 传入一个函数，对 CommonsChunk 决定哪些模块被打包到 vendor chunk 里进行更为细致的控制。
        // 参考文档：https://doc.webpack-china.org/plugins/commons-chunk-plugin/#-minchunks-
        new webpack.optimize.CommonsChunkPlugin({
            name: "vendor",
            minChunks: function(module) {
                // a module is extracted into the vendor chunk if...
                return (
                    // it's inside node_modules
                    /node_modules/.test(module.context) &&
                    // and not a CSS file (due to extract-text-webpack-plugin limitation)
                    !/\.css$/.test(module.request)
                );
            }
        }),
        // extract webpack runtime & manifest to avoid vendor chunk hash changing on every build.
        // 抽取webpack运行时代码到manifest chunk，避免每次执行构建生成的vendor chunk文件的hash值都不一样。
        // 参考文档：https://doc.webpack-china.org/guides/code-splitting-libraries/#manifest-
        new webpack.optimize.CommonsChunkPlugin({
            name: "manifest"
        }),
        // 此插件在输出目录中
        // 生成 `vue-ssr-client-manifest.json`。
        new VueSSRClientPlugin()
    ]
});

if (process.env.NODE_ENV === "production") {
    config.plugins.push(
        // auto generate service worker
        new SWPrecachePlugin({
            cacheId: "vue-hn",
            filename: "service-worker.js",
            minify: true,
            dontCacheBustUrlsMatching: /./,
            staticFileGlobsIgnorePatterns: [/\.map$/, /\.json$/],
            runtimeCaching: [
                {
                    urlPattern: "/",
                    handler: "networkFirst"
                },
                {
                    urlPattern: /\/(top|new|show|ask|jobs)/,
                    handler: "networkFirst"
                },
                {
                    urlPattern: "/item/:id",
                    handler: "networkFirst"
                },
                {
                    urlPattern: "/user/:id",
                    handler: "networkFirst"
                }
            ]
        })
    );
}

module.exports = config;
