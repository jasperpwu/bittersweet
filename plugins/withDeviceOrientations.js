const { withInfoPlist } = require("expo/config-plugins");

/**
 * Expo config plugin that pins supported orientations on both idioms.
 *
 * iPhone: portrait only
 * iPad:   portrait only
 *
 * A single supported orientation is what keeps us clear of the long-standing RN
 * bug where `Dimensions` go stale after a rotation on iPadOS (facebook/react-native#47262):
 * with nothing to rotate to, there is no aspect change to miss. This used to pin
 * iPad to landscape for that reason, but `~ipad` keys resolve by device idiom —
 * so an iPad ran this portrait-designed UI sideways. Portrait keeps the same
 * no-rotation guarantee and matches the layouts.
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

    // iPad: portrait only (matches iPhone — see note above)
    mod.modResults["UISupportedInterfaceOrientations~ipad"] = [
      "UIInterfaceOrientationPortrait",
    ];

    return mod;
  });
};

module.exports = withDeviceOrientations;
