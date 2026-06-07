const { withInfoPlist } = require("expo/config-plugins");

/**
 * Expo config plugin that sets different supported orientations
 * for iPhone and iPad.
 *
 * iPhone: portrait only
 * iPad: landscape only
 *
 * This runs after Expo's built-in orientation handling, so it
 * overrides the iPad-specific key set by `orientation` in app.json.
 */
const withDeviceOrientations = (config) => {
  return withInfoPlist(config, (mod) => {
    // iPhone: portrait only
    mod.modResults.UISupportedInterfaceOrientations = [
      "UIInterfaceOrientationPortrait",
    ];

    // iPad: landscape only
    mod.modResults["UISupportedInterfaceOrientations~ipad"] = [
      "UIInterfaceOrientationLandscapeLeft",
      "UIInterfaceOrientationLandscapeRight",
    ];

    return mod;
  });
};

module.exports = withDeviceOrientations;
