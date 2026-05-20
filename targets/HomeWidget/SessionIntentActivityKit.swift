import ActivityKit
import Foundation

// This file is ONLY compiled in the main app target (not the widget extension).
// It provides the real ActivityKit implementations for the WidgetActivityKit
// callback hooks defined in SessionIntent.swift.
//
// The system runs LiveActivityIntent.perform() in the main app process,
// so Activity.request() works here.
//
// LiveActivityAttributes is internal to the ExpoLiveActivity pod, so we define
// a matching copy here. ActivityKit matches activity types by struct name (not module),
// so this is compatible with the widget extension's copy in LiveActivityWidget.swift.

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    var timerEndDateInMilliseconds: Double?
    var timerStartDateInMilliseconds: Double?
    var progress: Double?
    var imageName: String?
    var dynamicIslandImageName: String?
    var dynamicIslandText: String?
  }

  var name: String
  var backgroundColor: String?
  var titleColor: String?
  var subtitleColor: String?
  var progressViewTint: String?
  var progressViewLabelColor: String?
  var deepLinkUrl: String?
  var timerType: DynamicIslandTimerType?
  var sessionType: String?

  enum DynamicIslandTimerType: String, Codable {
    case circular
    case digital
  }
}

// Discovered at runtime by WidgetActivityKit.registerIfNeeded() via NSClassFromString.
// This avoids compile-time references from SessionIntent.swift (which is compiled in
// both targets) to this file (which is only in the main app target).
@available(iOS 17.0, *)
@objc(WidgetActivityKitLoader)
class WidgetActivityKitLoader: NSObject {

  @objc class func registerHandlers() {
    WidgetActivityKit.startHandler = { tagName, duration, startTimeMs, endTimeMs, isInfinite in
      // End all existing activities first to prevent duplicates
      for activity in Activity<LiveActivityAttributes>.activities {
        let id = activity.id
        Task {
          await activity.end(nil, dismissalPolicy: .immediate)
          print("🧹 [Widget] Ended existing activity: \(id)")
        }
      }

      let subtitle: String? = isInfinite ? nil : "\(duration)m focus session"
      let timerDate: Double = isInfinite ? startTimeMs : endTimeMs

      let state = LiveActivityAttributes.ContentState(
        title: tagName,
        subtitle: subtitle,
        timerEndDateInMilliseconds: timerDate,
        timerStartDateInMilliseconds: startTimeMs,
        progress: nil,
        imageName: "app_icon",
        dynamicIslandImageName: "app_icon",
        dynamicIslandText: tagName
      )

      let attributes = LiveActivityAttributes(
        name: "focus",
        backgroundColor: "#D2B48C",
        titleColor: "#8B4513",
        subtitleColor: "#8B4513",
        progressViewTint: "#FF6347",
        progressViewLabelColor: "#8B4513",
        deepLinkUrl: nil,
        timerType: .digital,
        sessionType: nil
      )

      let staleDate: Date? = isInfinite ? nil : Date(timeIntervalSince1970: endTimeMs / 1000)

      do {
        let activity = try Activity.request(
          attributes: attributes,
          content: ActivityContent(state: state, staleDate: staleDate),
          pushType: nil
        )
        print("✅ [Widget] Started Live Activity: \(activity.id)")
        return activity.id
      } catch {
        print("❌ [Widget] Failed to start Live Activity: \(error)")
        return nil
      }
    }

    WidgetActivityKit.stopHandler = {
      for activity in Activity<LiveActivityAttributes>.activities {
        let id = activity.id
        Task {
          let finalState = LiveActivityAttributes.ContentState(
            title: "Focus Session Complete",
            subtitle: "Great work!",
            timerEndDateInMilliseconds: Double(Date().timeIntervalSince1970 * 1000),
            timerStartDateInMilliseconds: nil,
            progress: nil,
            imageName: nil,
            dynamicIslandImageName: nil,
            dynamicIslandText: nil
          )
          await activity.end(
            ActivityContent(state: finalState, staleDate: nil),
            dismissalPolicy: .immediate
          )
          print("✅ [Widget] Ended Live Activity: \(id)")
        }
      }
    }
  }
}
