// Storage backend selection: R2 if fully configured, otherwise local disk.
const config = require('../config');

let backend;
if (config.isR2Configured) {
  backend = require('./r2');
  console.log(`[storage] using R2 (bucket=${config.r2.bucket})`);
} else {
  backend = require('./local');
  console.log('[storage] using local disk (set R2_* env vars to use R2)');
}

module.exports = backend;
