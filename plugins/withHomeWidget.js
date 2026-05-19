const { withFinalizedMod } = require("@expo/config-plugins/build/plugins/withFinalizedMod");
const fs = require("fs");
const path = require("path");
const xcode = require("xcode");

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

      // Files for the widget extension target
      const widgetExtensionFiles = [
        "WidgetDataManager.swift",
        "SessionIntent.swift",
        "HomeScreenWidgetView.swift",
        "HomeScreenWidget.swift",
      ];

      // Files also needed in main app target (for LiveActivityIntent to run in app process)
      const mainAppFiles = [
        "WidgetDataManager.swift",
        "SessionIntent.swift",
        "SessionIntentActivityKit.swift",
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

      // 2. Copy shared files to main app directory
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

      // 3. Add files to pbxproj
      const xcodeProjectPath = path.join(
        platformRoot,
        "bittersweetmobile.xcodeproj",
        "project.pbxproj"
      );

      if (fs.existsSync(xcodeProjectPath)) {
        const project = xcode.project(xcodeProjectPath);
        project.parseSync();

        // 3a. Add widget extension files to widget extension target
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

        // 3b. Add shared files to main app target (for LiveActivityIntent)
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

        fs.writeFileSync(xcodeProjectPath, project.writeSync());
      }

      // 4. Modify LiveActivityWidgetBundle.swift
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
