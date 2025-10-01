const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'production',
  entry: {
    // Background script
    background: './browser-extension/background/background.js',
    
    // Content scripts
    'content-scripts/meet-detector': './browser-extension/content-scripts/meet-detector.js',
    'content-scripts/audio-capture': './browser-extension/content-scripts/audio-capture.js',
    'content-scripts/ui-injection': './browser-extension/content-scripts/ui-injection.js',
    
    // Popup
    'popup/popup': './browser-extension/popup/popup.js',
    
    // Options page
    'options/options': './browser-extension/options/options.js'
  },
  
  output: {
    path: path.resolve(__dirname, 'dist/browser-extension'),
    filename: '[name].js',
    clean: true
  },
  
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: 'asset/resource',
        generator: {
          filename: 'icons/[name][ext]'
        }
      }
    ]
  },
  
  plugins: [
    // Generate popup HTML
    new HtmlWebpackPlugin({
      template: './browser-extension/popup/popup.html',
      filename: 'popup/popup.html',
      chunks: ['popup/popup']
    }),
    
    // Generate options HTML
    new HtmlWebpackPlugin({
      template: './browser-extension/options/options.html',
      filename: 'options/options.html',
      chunks: ['options/options']
    })
  ],
  
  resolve: {
    extensions: ['.js', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@client': path.resolve(__dirname, 'src/client'),
      '@services': path.resolve(__dirname, 'src/client/services'),
      '@components': path.resolve(__dirname, 'src/client/components')
    }
  },
  
  optimization: {
    minimize: process.env.NODE_ENV === 'production',
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        }
      }
    }
  },
  
  // Extension-specific settings
  target: 'web',
  
  // Disable source maps in production for security
  devtool: process.env.NODE_ENV === 'development' ? 'source-map' : false
};