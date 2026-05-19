const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin that fixes the fmt 11.0.2 consteval C++20 error.
 *
 * The root cause: fmt's `base.h` enables `consteval` on newer Apple Clang,
 * but `FMT_STRING` then fails with "call to consteval function is not a
 * constant expression" when any pod includes fmt headers under C++20.
 *
 * Strategy: Use withDangerousMod to both:
 * 1. Clean up any old Podfile hooks from previous versions of this plugin.
 * 2. Inject a Podfile post_install hook that does a simple, line-by-line
 *    patch of base.h — wrapping the detection block in #ifndef.
 *
 * The Podfile hook runs after `pod install` so the file is guaranteed to exist.
 */

const withFmtFix = (config) => {
  config = withDangerousMod(config, [
    "ios",
    (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const podfilePath = path.join(platformRoot, "Podfile");
      let podfile = fs.readFileSync(podfilePath, "utf8");

      // --- Clean up ALL old Podfile hooks ---
      for (const oldTag of ["fmt-cxx17-fix", "fmt-consteval-fix", "fmt-consteval-fix-v2"]) {
        const oldMarker = `# @generated begin ${oldTag}`;
        const oldEnd = `# @generated end ${oldTag}`;
        while (podfile.includes(oldMarker)) {
          const beginIdx = podfile.indexOf(oldMarker);
          const endIdx = podfile.indexOf(oldEnd);
          if (endIdx === -1) break;
          podfile =
            podfile.slice(0, beginIdx) +
            podfile.slice(endIdx + oldEnd.length);
        }
      }

      const tag = "fmt-consteval-fix-v2";
      const marker = `# @generated begin ${tag}`;

      if (!podfile.includes(marker)) {
        // Ruby post_install hook that patches base.h line by line.
        // Strategy: read all lines, find the "Detect consteval" comment,
        // find the matching #endif, wrap the block in #ifndef FMT_USE_CONSTEVAL,
        // and prepend a forced #define FMT_USE_CONSTEVAL 0.
        const snippet = `
    ${marker}
    # Fix fmt 11.0.2 consteval error with newer Xcode/Clang.
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      content = File.read(fmt_base)
      patch_guard = '/* fmt-consteval-patched-v2 */'
      unless content.include?(patch_guard)
        lines = content.split("\\n")
        detect_start = nil
        detect_end = nil
        lines.each_with_index do |line, i|
          if line.include?('Detect consteval, C++20 constexpr extensions')
            detect_start = i
          end
          if detect_start && i > detect_start && line.strip =~ /^#endif$/
            detect_end = i
            break
          end
        end
        if detect_start && detect_end
          # Insert wrapper around the detection block
          lines.insert(detect_end + 1, '#endif /* FMT_USE_CONSTEVAL already defined */')
          lines.insert(detect_start, '#ifndef FMT_USE_CONSTEVAL')
          # Adjust indices after insert
          # Insert the forced define and guard before everything
          lines.insert(detect_start, '#endif')
          lines.insert(detect_start, '#  define FMT_USE_CONSTEVAL 0')
          lines.insert(detect_start, '#ifndef FMT_USE_CONSTEVAL')
          lines.insert(detect_start, '')
          lines.insert(detect_start, patch_guard)
          File.write(fmt_base, lines.join("\\n"))
          puts '[withFmtFix] Patched fmt/base.h: disabled consteval'
        else
          puts '[withFmtFix] WARNING: Could not find detection block in base.h'
        end
      end
    else
      puts '[withFmtFix] WARNING: fmt/base.h not found at ' + fmt_base
    end
    # @generated end ${tag}`;

        const anchor = "post_install do |installer|";
        const anchorIndex = podfile.indexOf(anchor);
        if (anchorIndex === -1) {
          console.warn(
            "[withFmtFix] Could not find post_install block in Podfile — skipping"
          );
          return config;
        }

        const insertPos = anchorIndex + anchor.length;
        podfile =
          podfile.slice(0, insertPos) + snippet + podfile.slice(insertPos);
      }

      fs.writeFileSync(podfilePath, podfile, "utf8");
      console.log("[withFmtFix] Injected fmt base.h patch into Podfile");

      return config;
    },
  ]);

  return config;
};

module.exports = withFmtFix;
