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

// Windows + Android emulator: Metro must listen on IPv4 (adb reverse / 10.0.2.2).
config.server = {
  ...config.server,
  host: '0.0.0.0',
};

module.exports = config;
