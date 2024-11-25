const path = require("path");
const webpack = require("webpack");

const web = {
  target: "web",
  entry: "./src/index.ts",
  devtool: "source-map",
  devServer: {
    static: path.join(__dirname, "dist"),
    compress: true,
    port: 9000,
  },
  mode: "production",
  plugins: [
    new webpack.ProvidePlugin({
      leaflet: "leaflet",
    }),
  ],
  externals: {
    leaflet: {
      commonjs: "leaflet",
      commonjs2: "leaflet",
      amd: "leaflet",
      root: "L", // indicates global variable
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.(glsl|vs|fs|vert|frag)$/,
        exclude: /node_modules/,
        use: ["ts-shader-loader"],
      },
      {
        test: /\.(png|jpg|gif)$/i,
        use: [
          {
            loader: "url-loader",
            options: {
              limit: 131072, // Convert images < 128kb to base64 strings (128 * 1024 = 131072 bytes)
              fallback: "file-loader", // Use file-loader for images larger than the limit
              name: "[name].[ext]",
              outputPath: "images/", // This is only used if an image exceeds the limit
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    filename: "glify-browser.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "umd",
  },
};

const node = {
  ...web,
  target: "node",
  output: {
    filename: "glify.js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "umd",
  },
};

module.exports = [web, node];
