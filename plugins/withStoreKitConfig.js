const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin that wires a local StoreKit configuration file into the
 * generated Xcode scheme, so the paywall has real products in dev builds.
 *
 * Why this is needed: the development variant builds as
 * `com.path2us.bittersweet.dev` (see APP_VARIANT in app.config.js), but the IAP
 * SKUs in src/config/constants.ts are registered in App Store Connect under the
 * production bundle ID. StoreKit resolves products against the *running* bundle
 * ID, so `fetchProducts()` returns an empty array in every .dev build and the
 * paywall's Continue button is permanently disabled. A local .storekit file
 * bypasses the App Store entirely and serves the products from disk.
 *
 * Scope: dev variant only (APP_VARIANT=development). A production prebuild
 * leaves the scheme untouched so release/TestFlight builds always talk to the
 * real App Store. The reference lives in the scheme's LaunchAction, which only
 * affects Run — archives (ArchiveAction) ignore it either way.
 *
 * IMPORTANT — this only takes effect when the app is launched from Xcode
 * (Cmd+R). Xcode is what pushes the configuration to the simulator's storekitd
 * at launch; `npx expo run:ios` builds with xcodebuild and launches with
 * simctl, which does not go through that path. See the README note below.
 *
 * The prices in storekit/Bittersweet.storekit are placeholders for local
 * testing — edit them to match App Store Connect if you care about the exact
 * "save %" copy on the paywall.
 */

const SOURCE = path.join("storekit", "Bittersweet.storekit");
const DEST_NAME = "Bittersweet.storekit";

// Relative to the .xcodeproj bundle, which is how Xcode resolves this path.
// The file is dropped next to it in ios/, so `../` lands on ios/.
const SCHEME_REFERENCE = `      <StoreKitConfigurationFileReference
         identifier = "../${DEST_NAME}">
      </StoreKitConfigurationFileReference>`;

// The closing tag carries the scheme's own indentation; match it so the inserted
// element lines up with the rest of the XML.
const LAUNCH_ACTION_CLOSE = /([ \t]*)<\/LaunchAction>/;

module.exports = function withStoreKitConfig(config) {
  if (process.env.APP_VARIANT !== "development") {
    return config;
  }

  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const { projectRoot, platformProjectRoot } = cfg.modRequest;

      // 1. Copy the tracked config into the generated ios/ directory.
      const source = path.join(projectRoot, SOURCE);
      if (!fs.existsSync(source)) {
        throw new Error(
          `withStoreKitConfig could not find ${SOURCE}. It is the source of truth for local IAP testing and must be committed.`
        );
      }
      fs.copyFileSync(source, path.join(platformProjectRoot, DEST_NAME));

      // 2. Point the shared scheme's LaunchAction at it. `projectName` is
      // optional on ModRequest, so fall back to locating the .xcodeproj.
      const xcodeproj = cfg.modRequest.projectName
        ? `${cfg.modRequest.projectName}.xcodeproj`
        : fs
            .readdirSync(platformProjectRoot)
            .find((entry) => entry.endsWith(".xcodeproj"));
      if (!xcodeproj) {
        throw new Error(
          `withStoreKitConfig could not locate an .xcodeproj in ${platformProjectRoot}.`
        );
      }

      const schemeDir = path.join(
        platformProjectRoot,
        xcodeproj,
        "xcshareddata",
        "xcschemes"
      );
      if (!fs.existsSync(schemeDir)) {
        throw new Error(
          `withStoreKitConfig expected shared schemes at ${schemeDir} but the directory does not exist.`
        );
      }

      const schemes = fs
        .readdirSync(schemeDir)
        .filter((file) => file.endsWith(".xcscheme"));
      if (schemes.length === 0) {
        throw new Error(
          `withStoreKitConfig found no .xcscheme files in ${schemeDir}.`
        );
      }

      for (const scheme of schemes) {
        const schemePath = path.join(schemeDir, scheme);
        const contents = fs.readFileSync(schemePath, "utf8");

        // Idempotent across repeated prebuilds.
        if (contents.includes("StoreKitConfigurationFileReference")) {
          continue;
        }
        if (!LAUNCH_ACTION_CLOSE.test(contents)) {
          throw new Error(
            `withStoreKitConfig could not find a LaunchAction to anchor on in ${scheme}.`
          );
        }

        fs.writeFileSync(
          schemePath,
          contents.replace(
            LAUNCH_ACTION_CLOSE,
            (_match, indent) => `${SCHEME_REFERENCE}\n${indent}</LaunchAction>`
          )
        );
      }

      return cfg;
    },
  ]);
};
