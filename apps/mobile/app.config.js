/**
 * Static fields live in app.json. This file applies the preview/production
 * variant at bundle and build time.
 *
 * APP_VARIANT=preview  → bundle id app.coopr.mobile.preview (TestFlight app)
 * APP_VARIANT=production → store bundle id, used with EXPO_PUBLIC_FOUNDER_TOOLS=0
 * Unset → Expo Go / local dev, bundle id app.coopr.mobile
 *
 * App Store Expo Go is SDK 58. runtimeVersion policy `sdkVersion` resolves to
 * exposdk:58.0.0, which is the runtime that build of Expo Go will load.
 * SDK 55 removed the newArchEnabled flag; the New Architecture is required.
 */
function lightSplash(plugins) {
  if (!Array.isArray(plugins)) return plugins;
  return plugins.map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'expo-splash-screen') return plugin;
    const options = { ...(plugin[1] ?? {}) };
    delete options.dark;
    if (options.android && typeof options.android === 'object') {
      const android = { ...options.android };
      delete android.dark;
      options.android = android;
    }
    return ['expo-splash-screen', options];
  });
}

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT === 'preview' ? 'preview' : process.env.APP_VARIANT === 'production' ? 'production' : 'dev';
  const preview = variant === 'preview';
  const projectId = process.env.EXPO_PROJECT_ID || config.extra?.eas?.projectId || null;
  const bundleIdentifier = preview ? 'app.coopr.mobile.preview' : 'app.coopr.mobile';

  // Screenshot exports set COOPR_WEB_STATIC=1 so `expo export -p web` writes
  // files a static server can host. EAS Hosting stays on `server` (app.json)
  // for the caddie and extract routes.
  const web =
    process.env.COOPR_WEB_STATIC === '1' ? { ...(config.web ?? {}), output: 'static' } : config.web;

  return {
    ...config,
    plugins: lightSplash(config.plugins),
    ...(web ? { web } : {}),
    name: preview ? 'COOPR Preview' : config.name,
    // Play paints its own navy. The rest of the app is light, so the system
    // chrome stays light instead of following a dark system appearance.
    userInterfaceStyle: 'light',
    ios: {
      ...config.ios,
      bundleIdentifier,
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        ITSAppUsesNonExemptEncryption: false,
        UIUserInterfaceStyle: 'Light',
      },
    },
    android: {
      ...config.android,
      package: preview ? 'app.coopr.mobile.preview' : config.android?.package,
    },
    runtimeVersion: {
      policy: 'sdkVersion',
    },
    updates: projectId
      ? {
          url: `https://u.expo.dev/${projectId}`,
        }
      : {
          enabled: false,
        },
    extra: {
      ...(config.extra ?? {}),
      eas: projectId ? { projectId } : { ...(config.extra?.eas ?? {}) },
    },
  };
};
