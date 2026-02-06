const path = require("path");

module.exports = {
  mode: "development",
  devtool: "source-map",
  entry: "./src/visual.ts",
  output: {
    path: path.join(__dirname, ".tmp", "drop"),
    filename: "visual.js",
    library: {
      name: "hybridWaterfallChartA1B2C3D4E5F67890",
      type: "var"
    },
    publicPath: "/assets"
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".css"]
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          {
            loader: "ts-loader",
            options: {
              transpileOnly: false
            }
          }
        ],
        exclude: /node_modules/
      },
      {
        test: /\.less$/,
        use: [
          "style-loader",
          "css-loader",
          "less-loader"
        ]
      }
    ]
  },
  externals: {
    "powerbi-visuals-api": "null"
  },
  optimization: {
    concatenateModules: false,
    minimize: false
  }
};
