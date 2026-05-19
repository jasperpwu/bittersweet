import Foundation
import WidgetKit

// MARK: - Shared App Group

private let appGroupId = "group.com.path2us.bittersweet.appblocker"

// MARK: - UserDefaults Keys

enum WidgetKeys {
  static let sessionData = "widgetSessionData"
  static let tagList = "widgetTagList"
  static let pendingAction = "pendingWidgetAction"
  static let widgetStartedSession = "widgetStartedSession"
  static let widgetStopAction = "widgetStopAction"
}

// MARK: - Data Models

struct WidgetSessionData {
  let isActive: Bool
  let tagName: String
  let tagIcon: String
  let tagColor: String
  let startTime: Double // Unix timestamp ms
  let endTime: Double   // Unix timestamp ms, 0 if infinite
  let isInfinite: Bool
  let todayTotalMinutes: Int?

  /// Initialize from a UserDefaults dictionary (written by JS via react-native-device-activity)
  init?(dict: [String: Any]) {
    guard let isActive = dict["isActive"] as? Bool else { return nil }
    self.isActive = isActive
    self.tagName = dict["tagName"] as? String ?? ""
    self.tagIcon = dict["tagIcon"] as? String ?? ""
    self.tagColor = dict["tagColor"] as? String ?? ""
    self.startTime = dict["startTime"] as? Double ?? 0
    self.endTime = dict["endTime"] as? Double ?? 0
    self.isInfinite = dict["isInfinite"] as? Bool ?? false
    self.todayTotalMinutes = dict["todayTotalMinutes"] as? Int
  }
}

struct WidgetTagInfo {
  let id: String
  let name: String
  let icon: String
  let color: String
  let lastDuration: Int? // minutes; nil = unknown, 0 = infinite

  init?(dict: [String: Any]) {
    guard let id = dict["id"] as? String,
          let name = dict["name"] as? String else { return nil }
    self.id = id
    self.name = name
    self.icon = dict["icon"] as? String ?? ""
    self.color = dict["color"] as? String ?? ""
    self.lastDuration = dict["lastDuration"] as? Int
  }
}

struct PendingWidgetAction {
  let action: String // "start" or "stop"
  let tagId: String?
  let duration: Int? // minutes; nil = unknown, 0 = infinite
  let timestamp: Double

  func toDict() -> [String: Any] {
    var dict: [String: Any] = [
      "action": action,
      "timestamp": timestamp
    ]
    if let tagId = tagId {
      dict["tagId"] = tagId
    }
    if let duration = duration {
      dict["duration"] = duration
    }
    return dict
  }
}

// MARK: - Data Manager

struct WidgetDataManager {
  static let shared = WidgetDataManager()

  private var userDefaults: UserDefaults? {
    UserDefaults(suiteName: appGroupId)
  }

  // MARK: - Read

  func getSessionData() -> WidgetSessionData? {
    guard let dict = userDefaults?.dictionary(forKey: WidgetKeys.sessionData) else { return nil }
    return WidgetSessionData(dict: dict)
  }

  func getTagList() -> [WidgetTagInfo] {
    guard let array = userDefaults?.array(forKey: WidgetKeys.tagList) as? [[String: Any]] else { return [] }
    return array.compactMap { WidgetTagInfo(dict: $0) }
  }

  // MARK: - Write Session Data

  func writeSessionData(
    isActive: Bool,
    tagName: String,
    tagIcon: String,
    tagColor: String,
    startTime: Double,
    endTime: Double,
    isInfinite: Bool
  ) {
    let dict: [String: Any] = [
      "isActive": isActive,
      "tagName": tagName,
      "tagIcon": tagIcon,
      "tagColor": tagColor,
      "startTime": startTime,
      "endTime": endTime,
      "isInfinite": isInfinite,
    ]
    userDefaults?.set(dict, forKey: WidgetKeys.sessionData)
    userDefaults?.synchronize()
  }

  func writePendingAction(_ action: PendingWidgetAction) {
    userDefaults?.set(action.toDict(), forKey: WidgetKeys.pendingAction)
    userDefaults?.synchronize() // Force flush to disk so the main app can read it immediately
  }

  // MARK: - Widget Started Session (for JS adoption)
  // The LiveActivityIntent starts the Live Activity in the main app process.
  // This data lets JS adopt the session when the user opens the app.

  func writeWidgetStartedSession(
    tagId: String,
    tagName: String,
    tagIcon: String,
    tagColor: String,
    duration: Int,
    startTime: Double,
    endTime: Double,
    isInfinite: Bool,
    liveActivityId: String?
  ) {
    var dict: [String: Any] = [
      "tagId": tagId,
      "tagName": tagName,
      "tagIcon": tagIcon,
      "tagColor": tagColor,
      "duration": duration,
      "startTime": startTime,
      "endTime": endTime,
      "isInfinite": isInfinite,
    ]
    if let liveActivityId = liveActivityId {
      dict["liveActivityId"] = liveActivityId
    }
    userDefaults?.set(dict, forKey: WidgetKeys.widgetStartedSession)
    userDefaults?.synchronize()
  }

  func clearWidgetStartedSession() {
    userDefaults?.removeObject(forKey: WidgetKeys.widgetStartedSession)
    userDefaults?.synchronize()
  }

  func getWidgetStartedSession() -> [String: Any]? {
    return userDefaults?.dictionary(forKey: WidgetKeys.widgetStartedSession)
  }

  // MARK: - Widget Stop Action (for JS adoption)

  func writeWidgetStopAction(timestamp: Double) {
    let dict: [String: Any] = [
      "action": "stop",
      "timestamp": timestamp,
    ]
    userDefaults?.set(dict, forKey: WidgetKeys.widgetStopAction)
    userDefaults?.synchronize()
  }

  func clearWidgetStopAction() {
    userDefaults?.removeObject(forKey: WidgetKeys.widgetStopAction)
    userDefaults?.synchronize()
  }

  func getWidgetStopAction() -> [String: Any]? {
    return userDefaults?.dictionary(forKey: WidgetKeys.widgetStopAction)
  }

  // MARK: - Widget Reload

  func reloadTimelines() {
    WidgetCenter.shared.reloadTimelines(ofKind: "com.path2us.bittersweet.HomeScreenWidget")
  }
}
