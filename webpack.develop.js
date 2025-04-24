const { merge } = require('webpack-merge')
const common = require('./webpack.common.js')

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Content-Security-Policy': "default-src 'self' http: 'unsafe-inline' 'unsafe-eval' ws: wss:; connect-src 'self' http: wss:; img-src 'self' http: data:; font-src 'self' http: data:;"
    },
    historyApiFallback: true,
    hot: true,
    host: 'localhost',
    port: 8080,
    allowedHosts: 'all',
    client: {
      webSocketURL: 'auto://0.0.0.0:0/ws'
    }
  },
}) 