import SwiftUI

extension Image {
  static func dynamic(assetNameOrPath: String) -> Self {
    NSLog("[LiveActivity] 🖼️ Attempting to load image: '\(assetNameOrPath)'")
    NSLog("[LiveActivity] 🔍 Bundle.main path: \(Bundle.main.bundlePath)")
    NSLog("[LiveActivity] 🔍 Bundle.main identifier: \(Bundle.main.bundleIdentifier ?? "nil")")

    // Log available asset catalogs
    if let assetsPath = Bundle.main.path(forResource: "Assets", ofType: "car") {
      NSLog("[LiveActivity] 📂 Found Assets.car at: \(assetsPath)")
    } else {
      NSLog("[LiveActivity] ❌ Assets.car not found in bundle")
    }

    // List all resources in bundle
    if let resourcePath = Bundle.main.resourcePath {
      do {
        let contents = try FileManager.default.contentsOfDirectory(atPath: resourcePath)
        NSLog("[LiveActivity] 📁 Bundle resources: \(contents.prefix(10).joined(separator: ", "))")
      } catch {
        NSLog("[LiveActivity] ❌ Could not list bundle contents: \(error)")
      }
    }

    // Try to load from Asset Catalog
    if let uiImage = UIImage(named: assetNameOrPath, in: Bundle.main, with: nil) ?? UIImage(named: assetNameOrPath) {
      NSLog("[LiveActivity] ✅ Successfully loaded from Asset Catalog: '\(assetNameOrPath)' - Size: \(uiImage.size)")
      NSLog("[LiveActivity] 🔍 UIImage scale: \(uiImage.scale), renderingMode: \(uiImage.renderingMode.rawValue)")
      NSLog("[LiveActivity] 🔍 UIImage CGImage is nil: \(uiImage.cgImage == nil)")
      NSLog("[LiveActivity] 🔍 UIImage CIImage is nil: \(uiImage.ciImage == nil)")

      // Force rendering mode to original to prevent template rendering
      let fixedImage = uiImage.withRenderingMode(.alwaysOriginal)
      return Image(uiImage: fixedImage)
    }

    NSLog("[LiveActivity] ❌ Failed to load '\(assetNameOrPath)' from Asset Catalog")

    // Fallback to default image if available
    if assetNameOrPath != "default-coffee-bean" {
      NSLog("[LiveActivity] 🔄 Trying default-coffee-bean as fallback")
      if let uiImage = UIImage(named: "default-coffee-bean", in: Bundle.main, with: nil) ?? UIImage(named: "default-coffee-bean") {
        NSLog("[LiveActivity] ✅ Successfully loaded default-coffee-bean as fallback")
        return Image(uiImage: uiImage)
          .renderingMode(.original)
      }
    }

    // Last resort: system icon
    NSLog("[LiveActivity] ⚠️ All image loading failed, using system photo icon")
    return Image(systemName: "photo")
  }
}
