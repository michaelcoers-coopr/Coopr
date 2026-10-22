/**
 * Static fields live in app.json. This file applies the preview/production
 * variant at bundle and build time.
 *
 * APP_VARIANT=preview  → bundle id app.coopr.mobile.preview (TestFlight app)
 * APP_VARIANT=production → store bundle id, used with EXPO_PUBLIC_FOUNDER_TOOLS=0
 * Unset → Expo Go / local dev, bundle id app.coopr.mobile
 *
 * Expo Go on the Apple App Store is SDK 54. Do not raise the SDK past 54 or
 * that Expo Go build will refuse the project.
 */
module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT === 'preview' ? 'preview' : process.env.APP_VARIANT === 'production' ? 'production' : 'dev';
  const preview = variant === 'preview';
  const projectId = process.env.EXPO_PROJECT_ID || config.extra?.eas?.projectId || null;
  const bundleIdentifier = preview ? 'app.coopr.mobile.preview' : 'app.coopr.mobile';

  return {
    ...config,
    name: preview ? 'COOPR Preview' : config.name,
    ios: {
      ...config.ios,
      bundleIdentifier,
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        ITSAppUsesNonExemptEncryption: false,
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
