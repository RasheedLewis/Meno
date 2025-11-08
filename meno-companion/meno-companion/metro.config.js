const { getDefaultConfig } = require('expo/metro-config');
const { resolve } = require('metro-resolver');
const path = require('path');

const config = getDefaultConfig(__dirname);

const polyfillPath = path.resolve(__dirname, 'polyfills/isomorphic-webcrypto-react-native.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'isomorphic-webcrypto/src/react-native') {
    return {
      type: 'sourceFile',
      filePath: polyfillPath,
    };
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;

