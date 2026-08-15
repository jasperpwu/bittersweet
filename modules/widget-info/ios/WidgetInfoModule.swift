import ExpoModulesCore
import WidgetKit

// Authoritative home-screen widget detection. WidgetCenter.getCurrentConfigurations
// (iOS 14+) asks the system which of our widgets the user currently has installed —
// the only reliable way to know, since iOS gives no callback when a widget is added.
public class WidgetInfoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetInfo")

    // Resolves to an array of installed widget family names (e.g.
    // ["systemSmall", "systemMedium"]). Empty array = no widgets installed.
    AsyncFunction("getInstalledWidgetFamilies") { (promise: Promise) in
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.getCurrentConfigurations { result in
          switch result {
          case .success(let widgets):
            let families = widgets.map { String(describing: $0.family) }
            promise.resolve(families)
          case .failure(let error):
            promise.reject("ERR_WIDGET_INFO", error.localizedDescription)
          }
        }
      } else {
        promise.resolve([String]())
      }
    }

    // Resolves to the kind identifiers of installed widgets (e.g.
    // ["com.path2us.bittersweet.GoalWidget"]) — lets callers tell *which* widget the
    // user has, not just its size. Empty array = none installed.
    AsyncFunction("getInstalledWidgetKinds") { (promise: Promise) in
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.getCurrentConfigurations { result in
          switch result {
          case .success(let widgets):
            let kinds = widgets.map { $0.kind }
            promise.resolve(kinds)
          case .failure(let error):
            promise.reject("ERR_WIDGET_INFO", error.localizedDescription)
          }
        }
      } else {
        promise.resolve([String]())
      }
    }
  }
}
