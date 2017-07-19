module.exports = {
    // 参考文章：https://vue-loader.vuejs.org/zh-cn/configurations/extract-css.html
    extractCSS: process.env.NODE_ENV === "production", // 在生产环境提取.vue文件style标签里的内容
    preserveWhitespace: false, // 是否删除HTML之间的空格
    postcss: [
        // css处理，为其增加浏览器前缀
        require("autoprefixer")({
            browsers: ["last 3 versions"]
        })
    ]
};
