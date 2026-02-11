const { resolve } = require("path");
const webpack = require("webpack");

module.exports = {
  bundler: "webpack",
  input: resolve(__dirname, "src/index.ts"),
  server: {
    port: 8080,
  },
  polyfills: {
    buffer: true,
    stream: true,
    crypto: true,
    path: true,
    url: true,
    os: true,
    assert: true,
    process: true,
    events: true,
    http: true,
    https: true,
    util: true,
    string_decoder: true,
    vm: true,
    zlib: true,
    punycode: true,
  },
  customizeWebpackConfig: (config) => {
    // Polyfill process/browser manually if needed, but 'process: true' above might handle it.
    // Handle node: imports by stripping the prefix
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, "");
      }),
      // Re-enable ProvidePlugin to ensure Buffer/process are available everywhere
      new webpack.ProvidePlugin({
        process: "process",
        Buffer: ["buffer", "Buffer"],
      }),
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify("production"),
        "process.env.DEBUG": JSON.stringify("false"),
        "process.versions": JSON.stringify({ node: "18.0.0" }),
        "process.version": JSON.stringify("v18.0.0"),
        "process.browser": JSON.stringify(true),
      }),
    );

    config.resolve.alias = {
      ...config.resolve.alias,
      url: resolve(__dirname, "src/shims/url.js"),
      buffer: resolve(__dirname, "node_modules/buffer/index.js"),
      process: resolve(__dirname, "node_modules/process/browser.js"),
      stream: resolve(__dirname, "node_modules/stream-browserify/"),
    };

    // Fallbacks
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      child_process: false,
    };

    return config;
  },
};
