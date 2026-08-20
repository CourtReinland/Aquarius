const { getDefaultConfig } = require('expo/metro-config');

/**
 * Expo Metro config.
 * Package exports help `@walletconnect/ethereum-provider` resolve its RN build.
 */
const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
