//@ts-check

"use strict";

const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const extensionConfig = {
  target: "node", // VS Code extensions run in a Node.js-context
  mode: "none", // this leaves the source code as close as possible to the original

  entry: "./src/extension.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "extension.js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  externals: {
    vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      path: require.resolve("path-browserify"),
      fs: false,
      crypto: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            options: {
              compilerOptions: {
                sourceMap: true,
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "node_modules/tiktoken/tiktoken_bg.wasm",
          to: "tiktoken_bg.wasm",
        },
        {
          from: "assets",
          to: "assets",
        },
      ],
    }),
  ],
  devtool: "source-map",
  infrastructureLogging: {
    level: "log",
  },
  optimization: {
    minimize: false,
  },
};

module.exports = [extensionConfig];
