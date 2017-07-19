const webpack = require("webpack");
const merge = require("webpack-merge");
const base = require("./webpack.base.config");
const nodeExternals = require("webpack-node-externals");
const VueSSRServerPlugin = require("vue-server-renderer/server-plugin");

module.exports = merge(base, {
    // 告知 `vue-loader` 输送面向服务器代码(server-oriented code)。
    target: "node",
    // 对 bundle renderer 提供 source map 支持
    devtool: "#source-map",
    entry: "./src/entry-server.js",
    output: {
        filename: "server-bundle.js",
        // 参考文档：https://doc.webpack-china.org/configuration/output/#output-librarytarget
        // CommonJs spec defines only exports. But module.exports is used by node.js and many other CommonJs implementations.
        // commonjs mean pure CommonJs
        // commonjs2 also includes the module.exports stuff.
        // 此处告知 server bundle 使用 Node 风格导出模块(Node-style exports)
        libraryTarget: "commonjs2"
    },
    resolve: {
        alias: {
            "create-api": "./create-api-server.js"
        }
    },
    // 参考文档：
    // https://doc.webpack-china.org/configuration/externals/#externals
    // https://github.com/liady/webpack-node-externals
    // 服务端不需要把node_modules的依赖包打到bundle里
    externals: nodeExternals({
        // 请注意，在 externals 选项中，我们将 CSS 文件列入白名单。这是因为从依赖模块导入的 CSS 还应该由 webpack 处理。
        // 如果你导入依赖于 webpack 的任何其他类型的文件（例如 *.vue, *.sass），那么你也应该将它们添加到白名单中。
        whitelist: /\.css$/
    }),
    plugins: [
        new webpack.DefinePlugin({
            "process.env.NODE_ENV": JSON.stringify(
                process.env.NODE_ENV || "development"
            ),
            "process.env.VUE_ENV": '"server"'
        }),
        // 这是将服务器的整个输出
        // 构建为单个 JSON 文件的插件。
        // 默认文件名为 `vue-ssr-server-bundle.json`
        new VueSSRServerPlugin()
    ]
});
