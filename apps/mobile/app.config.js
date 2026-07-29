// Dynamic Expo config. The native config plugins (secure-store, sqlite,
// apple-authentication) are only needed to configure a real native build — they modify
// entitlements and Info.plist. Expo Go uses its own prebuilt runtime and ignores them,
// and loading them under Node 22 crashes the CLI (a require(ESM) resolution bug in
// Expo SDK 51). So we include them only for actual builds. The native MODULES still work
// in Expo Go regardless; this only affects build-time config.
const IS_NATIVE_BUILD = process.env.EAS_BUILD === 'true' || process.env.COOPR_NATIVE === '1';

module.exports = ({ config }) => {
  const plugins = ['expo-router'];
  if (IS_NATIVE_BUILD) {
    plugins.push('expo-secure-store', 'expo-sqlite', 'expo-apple-authentication');
  }
  return { ...config, plugins };
};
