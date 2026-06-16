const { getDefaultConfig } = require('expo/metro-config');
const { resolve } = require('metro-resolver');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// react-native-webrtc imports `event-target-shim/index`, but v6 only exports `.`
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'event-target-shim/index') {
    return resolve(context, 'event-target-shim', platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
