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

// Windows: Metro reads hundreds of cache files at once while building the app's
// lazy chunks, which hits the open-file limit ("EMFILE: too many open files").
// Let at most 64 cache reads/writes run at a time; the rest wait their turn.
const CACHE_IO_LIMIT = 64;
let cacheIoActive = 0;
const cacheIoQueue = [];
const acquireCacheIo = () =>
  new Promise((done) => {
    if (cacheIoActive < CACHE_IO_LIMIT) {
      cacheIoActive++;
      done();
    } else {
      cacheIoQueue.push(done);
    }
  });
const releaseCacheIo = () => {
  const next = cacheIoQueue.shift();
  if (next) next();
  else cacheIoActive--;
};
const limited = (fn) => async (...args) => {
  await acquireCacheIo();
  try {
    return await fn(...args);
  } finally {
    releaseCacheIo();
  }
};
config.cacheStores = (config.cacheStores ?? []).map((store) => ({
  get: limited((key) => store.get(key)),
  set: limited((key, value) => store.set(key, value)),
  clear: () => store.clear(),
}));

// Windows + Android emulator: Metro must listen on IPv4 (adb reverse / 10.0.2.2).
config.server = {
  ...config.server,
  host: '0.0.0.0',
};

module.exports = config;
