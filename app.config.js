const IS_DEV = process.env.APP_VARIANT === 'development';

const PROD_BUNDLE_ID = 'com.path2us.bittersweet';
const PROD_APP_GROUP = 'group.com.path2us.bittersweet.appblocker';

const APP_GROUP = IS_DEV
  ? 'group.com.path2us.bittersweet.appblocker.dev'
  : PROD_APP_GROUP;

const BUNDLE_ID = IS_DEV ? `${PROD_BUNDLE_ID}.dev` : PROD_BUNDLE_ID;

// Google OAuth client IDs for native Google Sign-In (public identifiers, safe
// to commit). From Google Cloud Console → Credentials: one Web client (Supabase
// validates the ID token audience against it) + one iOS client per bundle ID.
const GOOGLE_WEB_CLIENT_ID =
  '383580120267-f8gknrjlc9gjl4tm4mfe5jqmn1f7ffh3.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = IS_DEV
  ? '383580120267-2lnfhp1cbhlenmeeagkh26puctl8ugj8.apps.googleusercontent.com'
  : '383580120267-6a7bkendofi4gv78g45nl97n4ftchu54.apps.googleusercontent.com';
// The iOS URL scheme is the reversed iOS client ID.
const GOOGLE_IOS_URL_SCHEME = `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.replace(
  '.apps.googleusercontent.com',
  ''
)}`;

export default ({ config }) => {
  // Keep the internal project name unchanged so the Xcode project directory
  // and extension target names remain consistent across dev/prod builds.
  // Use CFBundleDisplayName for the user-visible app name instead.
  const scheme = IS_DEV ? `${config.scheme}-dev` : config.scheme;

  // Create a deep copy of config to avoid modifying the original config object directly
  const newConfig = JSON.parse(JSON.stringify(config));

  newConfig.scheme = scheme;

  if (IS_DEV) {
    // Differentiate dev by icon only; the home-screen name stays "Bittersweet"
    // (CFBundleDisplayName from app.json).
    newConfig.icon = './assets/icon-dev.png';
  }

  if (newConfig.ios) {
    newConfig.ios.bundleIdentifier = BUNDLE_ID;

    // Dynamic entitlements
    newConfig.ios.entitlements = {
      'com.apple.developer.family-controls': true,
      'com.apple.security.application-groups': [APP_GROUP],
    };
  }

  if (newConfig.android) {
    newConfig.android.package = IS_DEV
      ? `${config.android.package}.dev`
      : config.android.package;
  }

  // Dynamic plugin configs for app group
  if (newConfig.plugins) {
    newConfig.plugins = newConfig.plugins.map((plugin) => {
      if (!Array.isArray(plugin)) return plugin;
      const [pluginName, pluginConfig] = plugin;

      if (pluginName === 'react-native-device-activity') {
        return [pluginName, { ...pluginConfig, appGroup: APP_GROUP }];
      }
      if (pluginName === 'expo-live-activity') {
        return [pluginName, { ...pluginConfig, appGroupIdentifier: APP_GROUP }];
      }
      if (pluginName === '@react-native-google-signin/google-signin') {
        return [pluginName, { ...pluginConfig, iosUrlScheme: GOOGLE_IOS_URL_SCHEME }];
      }
      return plugin;
    });
  }

  // Dynamic app extensions with correct bundle IDs and app groups (deduplicated)
  const appExtensions = [
    {
      bundleIdentifier: `${BUNDLE_ID}.ShieldConfiguration`,
      targetName: 'ShieldConfiguration',
      entitlements: {
        'com.apple.developer.family-controls': true,
        'com.apple.security.application-groups': [APP_GROUP],
      },
    },
    {
      bundleIdentifier: `${BUNDLE_ID}.ShieldAction`,
      targetName: 'ShieldAction',
      entitlements: {
        'com.apple.developer.family-controls': true,
        'com.apple.security.application-groups': [APP_GROUP],
      },
    },
    {
      bundleIdentifier: `${BUNDLE_ID}.ActivityMonitorExtension`,
      targetName: 'ActivityMonitorExtension',
      entitlements: {
        'com.apple.developer.family-controls': true,
        'com.apple.security.application-groups': [APP_GROUP],
      },
    },
    {
      bundleIdentifier: `${BUNDLE_ID}.bittersweetmobileLiveActivity`,
      targetName: 'bittersweetmobileLiveActivity',
      entitlements: {
        'com.apple.security.application-groups': [APP_GROUP],
      },
    },
  ];

  if (!newConfig.extra) newConfig.extra = {};
  if (!newConfig.extra.eas) newConfig.extra.eas = {};
  if (!newConfig.extra.eas.build) newConfig.extra.eas.build = {};
  if (!newConfig.extra.eas.build.experimental) newConfig.extra.eas.build.experimental = {};
  if (!newConfig.extra.eas.build.experimental.ios) newConfig.extra.eas.build.experimental.ios = {};

  newConfig.extra.eas.build.experimental.ios.appExtensions = appExtensions;

  // Expose app group ID for TypeScript code via expo-constants
  newConfig.extra.appGroupId = APP_GROUP;

  // Google Sign-In client IDs for GoogleSignin.configure() (read via expo-constants)
  newConfig.extra.googleWebClientId = GOOGLE_WEB_CLIENT_ID;
  newConfig.extra.googleIosClientId = GOOGLE_IOS_CLIENT_ID;

  return newConfig;
};
