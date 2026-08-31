const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');
config.resolver.assetExts.push('wasm');

// Metro's package-exports resolution mishandles drizzle-orm: subpaths like
// "drizzle-orm/expo-sqlite" import sibling files outside their own exports
// boundary (e.g. "../logger.js"), which Metro's exports-aware resolver
// refuses to follow. Disabling it falls back to plain relative resolution.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
