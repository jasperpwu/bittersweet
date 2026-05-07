const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }) => {
  const name = IS_DEV ? `${config.name} (Dev)` : config.name;
  const scheme = IS_DEV ? `${config.scheme}-dev` : config.scheme;
  
  // Create a deep copy of config to avoid modifying the original config object directly
  const newConfig = JSON.parse(JSON.stringify(config));
  
  newConfig.name = name;
  newConfig.scheme = scheme;
  
  if (newConfig.ios) {
    newConfig.ios.bundleIdentifier = IS_DEV 
      ? `${config.ios.bundleIdentifier}.dev` 
      : config.ios.bundleIdentifier;
  }
  
  if (newConfig.android) {
    newConfig.android.package = IS_DEV 
      ? `${config.android.package}.dev` 
      : config.android.package;
  }

  // Update app extensions bundle identifiers if they exist
  if (newConfig.extra?.eas?.build?.experimental?.ios?.appExtensions) {
    newConfig.extra.eas.build.experimental.ios.appExtensions = newConfig.extra.eas.build.experimental.ios.appExtensions.map(ext => ({
      ...ext,
      bundleIdentifier: IS_DEV 
        ? ext.bundleIdentifier.replace(config.ios.bundleIdentifier, `${config.ios.bundleIdentifier}.dev`) 
        : ext.bundleIdentifier,
    }));
  }

  return newConfig;
};
