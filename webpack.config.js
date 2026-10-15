const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, { mode }) => ({
    entry: './src/index.js',
    output: {
        path: `${__dirname}/dist`,
        filename: 'bundle.[contenthash].js',
        clean: true,
    },
    devtool: mode === 'production' ? false : 'eval-source-map',
    devServer: { open: true },
    performance: { hints: false },
    module: {
        rules: [
            { test: /\.css$/, use: ['style-loader', 'css-loader'] },
            { test: /\.(png|svg|mp3|glb|woff2?)$/, type: 'asset/resource' },
        ],
    },
    plugins: [new HtmlWebpackPlugin({ template: './src/index.html', favicon: './src/img/favicon.svg' })],
});
