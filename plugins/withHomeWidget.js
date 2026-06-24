const { withFinalizedMod } = require("@expo/config-plugins/build/plugins/withFinalizedMod");
const fs = require("fs");
const path = require("path");
const xcode = require("xcode");
const plist = require("@expo/plist");

/**
 * Expo config plugin that adds Home Screen Widget Swift files to the existing
 * Live Activity widget extension target (bittersweetmobileLiveActivity).
 *
 * Also adds SessionIntent.swift and WidgetDataManager.swift to the main app
 * target so that LiveActivityIntent perform() runs in the app's process,
 * enabling Activity.request() to start Live Activities from widget buttons.
 *
 * Uses withFinalizedMod which runs AFTER all other mods (including xcodeproj),
 * so the expo-live-activity plugin has already created the target and directory.
 */
const withHomeWidget = (config) => {
  return withFinalizedMod(config, [
    "ios",
    (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const projectRoot = config.modRequest.projectRoot;
      const liveActivityDir = path.join(platformRoot, "bittersweetmobileLiveActivity");
      const mainAppDir = path.join(platformRoot, "bittersweetmobile");
      const sourceDir = path.join(projectRoot, "targets", "HomeWidget");
      const liveActivitySourceDir = path.join(projectRoot, "targets", "LiveActivity");

      // Owned Live Activity Swift files — overwrite the library's copies
      const liveActivityFiles = [
        "LiveActivityView.swift",
        "LiveActivityWidget.swift",
        "LiveActivityWidgetBundle.swift",
        "ViewHelpers.swift",
        "Color+hex.swift",
        "Date+toTimerInterval.swift",
        "Image+dynamic.swift",
        "View+applyWidgetURL.swift",
        "View+applyIfPresent.swift",
      ];

      // Files for the widget extension target
      const widgetExtensionFiles = [
        "WidgetDataManager.swift",
        "SessionIntent.swift",
        "HomeScreenWidgetView.swift",
        "HomeScreenWidget.swift",
        "SupabaseClient.swift",
        "GoalWidget.swift",
        "GoalWidgetView.swift",
      ];

      // Files also needed in main app target (for LiveActivityIntent to run in app process)
      const mainAppFiles = [
        "WidgetDataManager.swift",
        "SessionIntent.swift",
        "SessionIntentActivityKit.swift",
        "SupabaseClient.swift",
        // Main-app target ONLY — an app may expose one AppShortcutsProvider, so this
        // must not also go into widgetExtensionFiles (would double-register).
        "FocusAppShortcuts.swift",
      ];

      // 1. Copy Swift files to widget extension directory
      if (!fs.existsSync(liveActivityDir)) {
        console.warn("[withHomeWidget] Live Activity directory missing, creating it");
        fs.mkdirSync(liveActivityDir, { recursive: true });
      }

      for (const file of widgetExtensionFiles) {
        const src = path.join(sourceDir, file);
        const dest = path.join(liveActivityDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[withHomeWidget] Copied ${file} to widget extension`);
        } else {
          console.warn(`[withHomeWidget] Source file not found: ${src}`);
        }
      }

      // 1b. Copy Live Activity color sets into widget extension Assets.xcassets
      const laAssetsSource = path.join(liveActivitySourceDir, "Assets.xcassets");
      const laAssetsDest = path.join(liveActivityDir, "Assets.xcassets");
      if (fs.existsSync(laAssetsSource)) {
        const colorSets = fs.readdirSync(laAssetsSource).filter(d => d.endsWith(".colorset"));
        for (const colorSet of colorSets) {
          const srcDir = path.join(laAssetsSource, colorSet);
          const destDir = path.join(laAssetsDest, colorSet);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          const files = fs.readdirSync(srcDir);
          for (const f of files) {
            fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
          }
          console.log(`[withHomeWidget] Copied color set ${colorSet} to widget extension assets`);
        }
      }

      // 2. Copy owned Live Activity Swift files, overwriting library's versions
      for (const file of liveActivityFiles) {
        const src = path.join(liveActivitySourceDir, file);
        const dest = path.join(liveActivityDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[withHomeWidget] Copied owned ${file} to widget extension`);
        } else {
          console.warn(`[withHomeWidget] Owned Live Activity file not found: ${src}`);
        }
      }

      for (const file of mainAppFiles) {
        const src = path.join(sourceDir, file);
        const dest = path.join(mainAppDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
          console.log(`[withHomeWidget] Copied ${file} to main app`);
        } else {
          console.warn(`[withHomeWidget] Source file not found: ${src}`);
        }
      }

      // 3. Inject REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP into the live activity
      //    extension's Info.plist so Swift code can read the app group at runtime.
      //    The RNDA plugin sets this as a project-level build setting and injects it
      //    into the main app + RNDA-managed extension Info.plists, but NOT the live
      //    activity extension which is managed by expo-live-activity.
      const liveActivityInfoPlistPath = path.join(liveActivityDir, "Info.plist");
      if (fs.existsSync(liveActivityInfoPlistPath)) {
        const infoPlistContent = fs.readFileSync(liveActivityInfoPlistPath, "utf8");
        const infoPlist = plist.default.parse(infoPlistContent);
        if (!infoPlist["REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP"]) {
          infoPlist["REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP"] =
            "$(REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP)";
          fs.writeFileSync(liveActivityInfoPlistPath, plist.default.build(infoPlist), "utf8");
          console.log("[withHomeWidget] Injected REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP into live activity Info.plist");
        }
      }

      // 3b. Raise widget extension deployment target to iOS 18 for
      // Apple Watch supplementalActivityFamilies support
      const updateDeploymentTarget = (proj, targetName, newTarget) => {
        const configs = proj.pbxXCBuildConfigurationSection();
        const targetUuid = findTargetUuid(proj, targetName);
        if (!targetUuid) return;
        const target = proj.pbxNativeTargetSection()[targetUuid];
        if (!target || !target.buildConfigurationList) return;
        const configList = proj.hash.project.objects["XCConfigurationList"][target.buildConfigurationList];
        if (!configList || !configList.buildConfigurations) return;
        for (const ref of configList.buildConfigurations) {
          const cfg = configs[ref.value];
          if (cfg && cfg.buildSettings) {
            cfg.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = newTarget;
          }
        }
        console.log(`[withHomeWidget] Set ${targetName} deployment target to iOS ${newTarget}`);
      };

      // 4. Add files to pbxproj
      const xcodeProjectPath = path.join(
        platformRoot,
        "bittersweetmobile.xcodeproj",
        "project.pbxproj"
      );

      if (fs.existsSync(xcodeProjectPath)) {
        const project = xcode.project(xcodeProjectPath);
        project.parseSync();

        // 4a. Add widget extension files to widget extension target
        const widgetTargetName = "bittersweetmobileLiveActivity";
        const widgetTargetUuid = findTargetUuid(project, widgetTargetName);

        if (widgetTargetUuid) {
          const groupKey = project.findPBXGroupKey({ name: widgetTargetName });

          if (groupKey) {
            for (const file of widgetExtensionFiles) {
              addFileToPbxproj(project, file, groupKey, widgetTargetUuid, widgetTargetName);
            }
          } else {
            console.warn(
              "[withHomeWidget] Could not find PBXGroup for " + widgetTargetName
            );
          }
        } else {
          console.warn(
            "[withHomeWidget] Could not find target " + widgetTargetName
          );
        }

        // 4b. Add shared files to main app target (for LiveActivityIntent)
        const mainAppTargetName = "bittersweetmobile";
        const mainAppTargetUuid = findTargetUuid(project, mainAppTargetName);

        if (mainAppTargetUuid) {
          const mainGroupKey = project.findPBXGroupKey({ name: mainAppTargetName });

          if (mainGroupKey) {
            for (const file of mainAppFiles) {
              // Main app group has no path prefix, so file paths must include the directory
              const filePath = `${mainAppTargetName}/${file}`;
              addFileToPbxproj(project, file, mainGroupKey, mainAppTargetUuid, mainAppTargetName, filePath);
            }
          } else {
            console.warn(
              "[withHomeWidget] Could not find PBXGroup for " + mainAppTargetName
            );
          }
        } else {
          console.warn(
            "[withHomeWidget] Could not find main app target " + mainAppTargetName
          );
        }

        // Raise widget extension deployment target to iOS 18
        updateDeploymentTarget(project, widgetTargetName, "18.0");

        fs.writeFileSync(xcodeProjectPath, project.writeSync());
      }

      // 5. Modify LiveActivityWidgetBundle.swift
      const bundlePath = path.join(
        liveActivityDir,
        "LiveActivityWidgetBundle.swift"
      );
      if (fs.existsSync(bundlePath)) {
        let bundleContent = fs.readFileSync(bundlePath, "utf8");
        // Migrate from single HomeScreenWidget to split Small/Medium widgets
        if (bundleContent.includes("HomeScreenWidget()")) {
          bundleContent = bundleContent.replace(
            "HomeScreenWidget()",
            "SmallFocusWidget()\n    MediumFocusWidget()"
          );
          fs.writeFileSync(bundlePath, bundleContent, "utf8");
          console.log(
            "[withHomeWidget] Migrated HomeScreenWidget to SmallFocusWidget + MediumFocusWidget"
          );
        } else if (!bundleContent.includes("SmallFocusWidget()")) {
          bundleContent = bundleContent.replace(
            "LiveActivityWidget()",
            "LiveActivityWidget()\n    SmallFocusWidget()\n    MediumFocusWidget()"
          );
          fs.writeFileSync(bundlePath, bundleContent, "utf8");
          console.log(
            "[withHomeWidget] Added SmallFocusWidget + MediumFocusWidget to widget bundle"
          );
        }

        // Re-read in case we just wrote above
        bundleContent = fs.readFileSync(bundlePath, "utf8");

        // Add GoalWidget if not already present
        if (!bundleContent.includes("GoalWidget()")) {
          bundleContent = bundleContent.replace(
            "MediumFocusWidget()",
            "MediumFocusWidget()\n    GoalWidget()"
          );
          fs.writeFileSync(bundlePath, bundleContent, "utf8");
          console.log(
            "[withHomeWidget] Added GoalWidget to widget bundle"
          );
        }
      }

      return config;
    },
  ]);
};

/**
 * Add a Swift file to a target in the pbxproj.
 * Checks for existing file references in the specific target to avoid duplicates.
 * @param {string} filePath - Path relative to the group's sourceTree (e.g. "SessionIntent.swift"
 *   for groups with a path, or "bittersweetmobile/SessionIntent.swift" for groups without one)
 */
function addFileToPbxproj(project, file, groupKey, targetUuid, targetName, filePath) {
  if (!filePath) filePath = file;
  // Check if this file is already in this specific target's build phase
  const sourcesBuildPhaseId = findSourcesBuildPhase(project, targetUuid);
  if (sourcesBuildPhaseId) {
    const phase = project.hash.project.objects["PBXSourcesBuildPhase"][sourcesBuildPhaseId];
    if (phase && phase.files) {
      const alreadyInTarget = phase.files.some(f => {
        const comment = project.hash.project.objects["PBXBuildFile"][`${f.value}_comment`];
        return comment === `${file} in Sources`;
      });
      if (alreadyInTarget) {
        console.log(`[withHomeWidget] ${file} already in ${targetName}, skipping`);
        return;
      }
    }
  }

  const fileRefUuid = project.generateUuid();
  const buildFileUuid = project.generateUuid();

  // PBXFileReference
  project.hash.project.objects["PBXFileReference"][fileRefUuid] = {
    isa: "PBXFileReference",
    explicitFileType: undefined,
    fileEncoding: 4,
    includeInIndex: 0,
    lastKnownFileType: "sourcecode.swift",
    name: file,
    path: filePath,
    sourceTree: '"<group>"',
  };
  project.hash.project.objects["PBXFileReference"][
    `${fileRefUuid}_comment`
  ] = file;

  // PBXBuildFile
  project.hash.project.objects["PBXBuildFile"][buildFileUuid] = {
    isa: "PBXBuildFile",
    fileRef: fileRefUuid,
    fileRef_comment: file,
  };
  project.hash.project.objects["PBXBuildFile"][
    `${buildFileUuid}_comment`
  ] = `${file} in Sources`;

  // Add to group children
  const group = project.hash.project.objects["PBXGroup"][groupKey];
  if (group && group.children) {
    group.children.push({
      value: fileRefUuid,
      comment: file,
    });
  }

  // Add to target's Sources build phase
  if (sourcesBuildPhaseId) {
    const phase =
      project.hash.project.objects["PBXSourcesBuildPhase"][sourcesBuildPhaseId];
    if (phase && phase.files) {
      phase.files.push({
        value: buildFileUuid,
        comment: `${file} in Sources`,
      });
    }
  }

  console.log(`[withHomeWidget] Added ${file} to ${targetName} in pbxproj`);
}

function findTargetUuid(project, targetName) {
  const targets = project.pbxNativeTargetSection();
  for (const key in targets) {
    if (key.endsWith("_comment")) continue;
    if (targets[key].name === targetName) return key;
  }
  return null;
}

function findSourcesBuildPhase(project, targetUuid) {
  const target = project.pbxNativeTargetSection()[targetUuid];
  if (!target || !target.buildPhases) return null;
  for (const phase of target.buildPhases) {
    const obj =
      project.hash.project.objects["PBXSourcesBuildPhase"][phase.value];
    if (obj) return phase.value;
  }
  return null;
}

module.exports = withHomeWidget;
