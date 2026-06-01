import Foundation
import WidgetKit

// MARK: - Shared App Group (read from Info.plist, set at build time by react-native-device-activity plugin)

private let appGroupId: String = {
  Bundle.main.object(forInfoDictionaryKey: "REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP") as? String
    ?? "group.com.path2us.bittersweet.appblocker"
}()

// MARK: - UserDefaults Keys

enum WidgetKeys {
  static let sessionData = "widgetSessionData"
  static let tagList = "widgetTagList"
  static let pendingAction = "pendingWidgetAction"
  static let widgetStartedSession = "widgetStartedSession"
  static let widgetStopAction = "widgetStopAction"
  static let selectedTagId = "widgetSelectedTagId"
  static let fruitBalance = "widgetFruitBalance"
  static let widgetUnlockStopAction = "widgetUnlockStopAction"
  static let currentSelectionId = "widgetCurrentSelectionId"
  static let unlockSessionData = "widgetUnlockSessionData"
  static let scheduledNotificationId = "widgetScheduledNotificationId"

  // Supabase sync keys (written by JS for native intent REST calls)
  static let supabaseUserId = "supabaseUserId"
  static let supabaseAccessToken = "supabaseAccessToken"
  static let groveSharedTagIds = "groveSharedTagIds"
  static let groveShareNotes = "groveShareNotes"
  static let groveShowLiveStatus = "groveShowLiveStatus"
  static let groveActiveChallenges = "groveActiveChallenges"
}

// UserDefaults keys used by react-native-device-activity for shield configuration
private enum ShieldKeys {
  static let shieldConfiguration = "shieldConfiguration"
  static let shieldActions = "shieldActions"
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
  let usageCount: Int

  init?(dict: [String: Any]) {
    guard let id = dict["id"] as? String,
          let name = dict["name"] as? String else { return nil }
    self.id = id
    self.name = name
    self.icon = dict["icon"] as? String ?? ""
    self.color = dict["color"] as? String ?? ""
    self.lastDuration = dict["lastDuration"] as? Int
    self.usageCount = dict["usageCount"] as? Int ?? 0
  }
}

struct WidgetUnlockSessionData {
  let isActive: Bool
  let endTime: Double // Unix timestamp ms

  init?(dict: [String: Any]) {
    guard let isActive = dict["isActive"] as? Bool else { return nil }
    self.isActive = isActive
    self.endTime = dict["endTime"] as? Double ?? 0
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

  func getSelectedTagId() -> String? {
    return userDefaults?.string(forKey: WidgetKeys.selectedTagId)
  }

  func getUnlockSessionData() -> WidgetUnlockSessionData? {
    guard let dict = userDefaults?.dictionary(forKey: WidgetKeys.unlockSessionData) else { return nil }
    return WidgetUnlockSessionData(dict: dict)
  }

  func writeUnlockSessionData(isActive: Bool, endTime: Double) {
    let dict: [String: Any] = [
      "isActive": isActive,
      "endTime": endTime,
    ]
    userDefaults?.set(dict, forKey: WidgetKeys.unlockSessionData)
    userDefaults?.synchronize()
  }

  func clearUnlockSessionData() {
    userDefaults?.removeObject(forKey: WidgetKeys.unlockSessionData)
    userDefaults?.synchronize()
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

  // MARK: - Widget Unlock Stop Action (for JS adoption)

  func writeWidgetUnlockStopAction(timestamp: Double) {
    let dict: [String: Any] = [
      "action": "stopUnlock",
      "timestamp": timestamp,
    ]
    userDefaults?.set(dict, forKey: WidgetKeys.widgetUnlockStopAction)
    userDefaults?.synchronize()
  }

  func clearWidgetUnlockStopAction() {
    userDefaults?.removeObject(forKey: WidgetKeys.widgetUnlockStopAction)
    userDefaults?.synchronize()
  }

  func getWidgetUnlockStopAction() -> [String: Any]? {
    return userDefaults?.dictionary(forKey: WidgetKeys.widgetUnlockStopAction)
  }

  // MARK: - Scheduled Notification ID (for native cancellation on stop)

  func getAndClearScheduledNotificationId() -> String? {
    let id = userDefaults?.string(forKey: WidgetKeys.scheduledNotificationId)
    if id != nil {
      userDefaults?.removeObject(forKey: WidgetKeys.scheduledNotificationId)
      userDefaults?.synchronize()
    }
    return id
  }

  // MARK: - Fruit Balance (synced from JS for shield updates)

  func getFruitBalance() -> Int {
    return userDefaults?.integer(forKey: WidgetKeys.fruitBalance) ?? 0
  }

  // MARK: - Current Selection ID (for re-blocking from native)

  func getCurrentSelectionId() -> String? {
    return userDefaults?.string(forKey: WidgetKeys.currentSelectionId)
  }

  // MARK: - Shield Configuration

  /// Restore the shield to non-focus-session mode so users can unlock apps with fruits.
  /// Called from StopSessionIntent when a session is stopped from the widget,
  /// since JS won't run until the app foregrounds.
  func restoreShieldForNonFocusMode() {
    let balance = getFruitBalance()

    let shieldConfig: [String: Any] = [
      "title": "{applicationOrDomainDisplayName} is Blocked",
      "subtitle": "You have \(balance) 🍎\nSpend fruits to unlock temporarily",
      "primaryButtonLabel": "Unlock App",
      "secondaryButtonLabel": "Close",
      "iconSystemName": "hand.raised.fill",
      "backgroundBlurStyle": 18, // UIBlurEffect.Style.systemMaterialDark
      "backgroundColor": ["red": 178.0, "green": 25.0, "blue": 25.0, "alpha": 1.0],
      "titleColor": ["red": 255.0, "green": 255.0, "blue": 255.0, "alpha": 1.0],
      "subtitleColor": ["red": 230.0, "green": 230.0, "blue": 230.0, "alpha": 1.0],
      "primaryButtonLabelColor": ["red": 255.0, "green": 255.0, "blue": 255.0, "alpha": 1.0],
      "primaryButtonBackgroundColor": ["red": 51.0, "green": 153.0, "blue": 51.0, "alpha": 1.0],
      "secondaryButtonLabelColor": ["red": 100.0, "green": 100.0, "blue": 100.0, "alpha": 1.0],
    ]

    let shieldActions: [String: Any] = [
      "primary": [
        "behavior": "defer",
        "actions": [
          ["type": "openAppWithBundleId", "bundleId": Bundle.main.bundleIdentifier ?? "com.path2us.bittersweet"]
        ]
      ] as [String: Any],
      "secondary": [
        "behavior": "close"
      ] as [String: Any],
    ]

    userDefaults?.set(shieldConfig, forKey: ShieldKeys.shieldConfiguration)
    userDefaults?.set(shieldActions, forKey: ShieldKeys.shieldActions)
    userDefaults?.synchronize()
  }

  /// Set the shield to focus-session mode (block unlocking during focus).
  /// Called from StartSessionIntent when a session is started from the widget.
  func setShieldForFocusMode() {
    let shieldConfig: [String: Any] = [
      "title": "{applicationOrDomainDisplayName} is Blocked",
      "subtitle": "Focus session in progress\nStay focused!",
      "primaryButtonLabel": "Close",
      "iconSystemName": "hand.raised.fill",
      "backgroundBlurStyle": 18, // UIBlurEffect.Style.systemMaterialDark
      "backgroundColor": ["red": 178.0, "green": 25.0, "blue": 25.0, "alpha": 1.0],
      "titleColor": ["red": 255.0, "green": 255.0, "blue": 255.0, "alpha": 1.0],
      "subtitleColor": ["red": 230.0, "green": 230.0, "blue": 230.0, "alpha": 1.0],
      "primaryButtonLabelColor": ["red": 255.0, "green": 255.0, "blue": 255.0, "alpha": 1.0],
      "primaryButtonBackgroundColor": ["red": 178.0, "green": 25.0, "blue": 25.0, "alpha": 1.0],
    ]

    let shieldActions: [String: Any] = [
      "primary": [
        "behavior": "close"
      ] as [String: Any],
      "secondary": [
        "behavior": "close"
      ] as [String: Any],
    ]

    userDefaults?.set(shieldConfig, forKey: ShieldKeys.shieldConfiguration)
    userDefaults?.set(shieldActions, forKey: ShieldKeys.shieldActions)
    userDefaults?.synchronize()
  }

  // MARK: - Supabase Credentials + Privacy (for native intent REST calls)

  func getSupabaseUserId() -> String? {
    return userDefaults?.string(forKey: WidgetKeys.supabaseUserId)
  }

  func getSupabaseAccessToken() -> String? {
    return userDefaults?.string(forKey: WidgetKeys.supabaseAccessToken)
  }

  func getGroveShowLiveStatus() -> Bool {
    return userDefaults?.bool(forKey: WidgetKeys.groveShowLiveStatus) ?? false
  }

  func getGroveShareNotes() -> Bool {
    return userDefaults?.bool(forKey: WidgetKeys.groveShareNotes) ?? false
  }

  func getGroveSharedTagIds() -> [String] {
    guard let jsonString = userDefaults?.string(forKey: WidgetKeys.groveSharedTagIds),
          let data = jsonString.data(using: .utf8),
          let array = try? JSONSerialization.jsonObject(with: data) as? [String] else {
      return []
    }
    return array
  }

  func getGroveActiveChallenges() -> [[String: String]] {
    guard let jsonString = userDefaults?.string(forKey: WidgetKeys.groveActiveChallenges),
          let data = jsonString.data(using: .utf8),
          let array = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] else {
      return []
    }
    return array
  }

  // MARK: - Widget Reload

  func reloadTimelines() {
    WidgetCenter.shared.reloadTimelines(ofKind: "com.path2us.bittersweet.HomeScreenWidget")
    WidgetCenter.shared.reloadTimelines(ofKind: "com.path2us.bittersweet.MediumFocusWidget")
  }
}
