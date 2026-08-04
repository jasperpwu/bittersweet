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
  static let goalsData = "widgetGoalsData"
  static let scheduledNotificationId = "widgetScheduledNotificationId"
  static let todoList = "widgetTodoList"
  static let todoToggles = "widgetTodoToggles"
  static let openNewTodo = "widgetOpenNewTodo"
  // Localized strings for text the widget/Live Activity renders itself (JS isn't
  // running when iOS draws them). Synced from JS on launch + language change.
  static let widgetStrings = "widgetStrings"

  // Supabase sync keys (written by JS for native intent REST calls)
  static let supabaseUserId = "supabaseUserId"
  static let supabaseAccessToken = "supabaseAccessToken"
  static let groveShowLiveStatus = "groveShowLiveStatus"
  static let groveActiveChallenges = "groveActiveChallenges"
}

// UserDefaults keys used by react-native-device-activity for shield configuration
private enum ShieldKeys {
  static let shieldConfiguration = "shieldConfiguration"
  static let shieldActions = "shieldActions"
  // Localized string templates synced from JS (configureShield); values follow
  // the in-app language preference, English fallbacks below if never synced
  static let shieldStrings = "shieldStrings"
}

// MARK: - Data Models

struct WidgetSessionData {
  let isActive: Bool
  let tagId: String
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
    self.tagId = dict["tagId"] as? String ?? ""
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
  let lastUsedAt: Double // Unix timestamp ms; 0 = never used

  init?(dict: [String: Any]) {
    guard let id = dict["id"] as? String,
          let name = dict["name"] as? String else { return nil }
    self.id = id
    self.name = name
    self.icon = dict["icon"] as? String ?? ""
    self.color = dict["color"] as? String ?? ""
    self.lastDuration = dict["lastDuration"] as? Int
    self.lastUsedAt = dict["lastUsedAt"] as? Double ?? 0
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

struct WidgetGoalItem {
  let name: String
  let currentMinutes: Double
  let targetMinutes: Double
  let percentage: Double
  let period: String // "Daily" / "Weekly" / "Monthly"
  let tagId: String // 1:1 with tag — used to match a finished session to its goal
  let tagIcon: String
  let tagColor: String

  init?(dict: [String: Any]) {
    guard let name = dict["name"] as? String else { return nil }
    self.name = name
    self.currentMinutes = dict["currentMinutes"] as? Double ?? 0
    self.targetMinutes = dict["targetMinutes"] as? Double ?? 0
    self.percentage = dict["percentage"] as? Double ?? 0
    self.period = dict["period"] as? String ?? "Daily"
    self.tagId = dict["tagId"] as? String ?? ""
    self.tagIcon = dict["tagIcon"] as? String ?? ""
    self.tagColor = dict["tagColor"] as? String ?? ""
  }
}

/// One flattened row for the TODO widget — a section header or a todo. Built by
/// JS (`widgetTodos.ts`) in the same order as the Journal sheet; completed todos
/// are excluded.
struct WidgetTodoItem {
  enum Kind { case header, todo }
  let kind: Kind
  // Header fields
  let title: String
  let count: Int
  // Todo fields
  let id: String
  let name: String
  let tagIcon: String
  let tagColor: String

  init?(dict: [String: Any]) {
    guard let type = dict["type"] as? String else { return nil }
    switch type {
    case "header":
      self.kind = .header
      self.title = dict["title"] as? String ?? ""
      self.count = dict["count"] as? Int ?? 0
      self.id = ""; self.name = ""; self.tagIcon = ""; self.tagColor = ""
    case "todo":
      guard let id = dict["id"] as? String else { return nil }
      self.kind = .todo
      self.id = id
      self.name = dict["name"] as? String ?? ""
      self.tagIcon = dict["tagIcon"] as? String ?? ""
      self.tagColor = dict["tagColor"] as? String ?? ""
      self.title = ""; self.count = 0
    default:
      return nil
    }
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

  // MARK: - Localized Strings

  /// Localized UI strings synced from JS, keyed by name. Falls back to the
  /// English literal when JS has never run (fresh install, widget added before
  /// first launch) or when a key predates the installed app version.
  func widgetString(_ key: String, fallback: String) -> String {
    let strings = userDefaults?.dictionary(forKey: WidgetKeys.widgetStrings) as? [String: String]
    return strings?[key] ?? fallback
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

  func getGoalsData() -> [WidgetGoalItem] {
    guard let array = userDefaults?.array(forKey: WidgetKeys.goalsData) as? [[String: Any]] else { return [] }
    return array.compactMap { WidgetGoalItem(dict: $0) }
  }

  /// Incrementally adds a just-finished session's minutes to the goal that tracks
  /// the same tag, so the goal widget reflects the session immediately after an
  /// End Session tap from a widget / Live Activity (JS isn't running to recompute).
  ///
  /// This is an approximation: it only bumps the matching goal's currentMinutes /
  /// percentage in the stored payload. When the app next foregrounds, JS recomputes
  /// every goal from scratch (`syncWidgetGoalsData`) and corrects any drift, mirroring
  /// how the session widget itself reconciles on foreground.
  func addSessionMinutesToGoal(tagId: String, minutes: Double) {
    guard minutes > 0, !tagId.isEmpty else { return }
    guard var array = userDefaults?.array(forKey: WidgetKeys.goalsData) as? [[String: Any]] else { return }

    var didChange = false
    for index in array.indices {
      guard (array[index]["tagId"] as? String) == tagId else { continue }
      let target = array[index]["targetMinutes"] as? Double ?? 0
      let current = (array[index]["currentMinutes"] as? Double ?? 0) + minutes
      array[index]["currentMinutes"] = current
      array[index]["percentage"] = target > 0 ? (current / target * 100).rounded() : 0
      didChange = true
    }

    guard didChange else { return }
    userDefaults?.set(array, forKey: WidgetKeys.goalsData)
    userDefaults?.synchronize()
  }

  // MARK: - TODO Widget

  func getTodoList() -> [WidgetTodoItem] {
    guard let array = userDefaults?.array(forKey: WidgetKeys.todoList) as? [[String: Any]] else { return [] }
    return array.compactMap { WidgetTodoItem(dict: $0) }
  }

  /// Record a TODO toggle tapped on the widget: queue it for JS adoption AND
  /// remove the todo from the stored snapshot so the row vanishes immediately
  /// (the widget only shows incomplete todos). Empty section headers are dropped
  /// and remaining header counts updated. JS re-syncs the full list on next
  /// foreground, correcting any drift.
  func appendTodoToggle(id: String, completed: Bool) {
    guard !id.isEmpty else { return }

    // Queue the toggle for JS adoption.
    var toggles = userDefaults?.array(forKey: WidgetKeys.todoToggles) as? [[String: Any]] ?? []
    toggles.append([
      "id": id,
      "completed": completed,
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ])
    userDefaults?.set(toggles, forKey: WidgetKeys.todoToggles)

    // Optimistically drop the toggled todo from the snapshot, then compact away
    // any now-empty headers and refresh header counts.
    if var list = userDefaults?.array(forKey: WidgetKeys.todoList) as? [[String: Any]] {
      list.removeAll { ($0["type"] as? String) == "todo" && ($0["id"] as? String) == id }
      userDefaults?.set(compactTodoList(list), forKey: WidgetKeys.todoList)
    }

    userDefaults?.synchronize()
  }

  /// Mark that the "+" button was tapped on the TODO widget. JS reads & clears
  /// this on foreground/launch and navigates to the new-TODO modal.
  func requestOpenNewTodo() {
    userDefaults?.set(Date().timeIntervalSince1970 * 1000, forKey: WidgetKeys.openNewTodo)
    userDefaults?.synchronize()
  }

  /// Rebuild a flattened todo list so each header reflects its real todo count
  /// and headers with no following todos are removed.
  private func compactTodoList(_ list: [[String: Any]]) -> [[String: Any]] {
    var result: [[String: Any]] = []
    var index = 0
    while index < list.count {
      let item = list[index]
      if (item["type"] as? String) == "header" {
        var todoCount = 0
        var next = index + 1
        while next < list.count, (list[next]["type"] as? String) != "header" {
          todoCount += 1
          next += 1
        }
        if todoCount > 0 {
          var header = item
          header["count"] = todoCount
          result.append(header)
        }
        index += 1
      } else {
        result.append(item)
        index += 1
      }
    }
    return result
  }

  // MARK: - Write Session Data

  func writeSessionData(
    isActive: Bool,
    tagId: String,
    tagName: String,
    tagIcon: String,
    tagColor: String,
    startTime: Double,
    endTime: Double,
    isInfinite: Bool
  ) {
    let dict: [String: Any] = [
      "isActive": isActive,
      "tagId": tagId,
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

  func writeWidgetStopAction(timestamp: Double, sessionId: String) {
    let dict: [String: Any] = [
      "action": "stop",
      "timestamp": timestamp,
      "sessionId": sessionId,
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

  /// Localized shield strings synced from JS, keyed by template name.
  private func getShieldStrings() -> [String: String] {
    return userDefaults?.dictionary(forKey: ShieldKeys.shieldStrings) as? [String: String] ?? [:]
  }

  /// Restore the shield to non-focus-session mode so users can unlock apps with fruits.
  /// Called from StopSessionIntent when a session is stopped from the widget,
  /// since JS won't run until the app foregrounds.
  func restoreShieldForNonFocusMode() {
    let balance = getFruitBalance()
    let strings = getShieldStrings()
    let subtitle = (strings["balanceSubtitle"]
      ?? "You have {balance} 🍎\nSpend fruits to unlock temporarily")
      .replacingOccurrences(of: "{balance}", with: "\(balance)")

    let shieldConfig: [String: Any] = [
      "title": strings["title"] ?? "{applicationOrDomainDisplayName} is Blocked",
      "subtitle": subtitle,
      "primaryButtonLabel": strings["unlockButton"] ?? "Unlock App",
      "secondaryButtonLabel": strings["closeButton"] ?? "Close",
      "iconSystemName": "hand.raised.fill",
      "backgroundBlurStyle": 18, // UIBlurEffect.Style.systemMaterialDark
      "backgroundColor": ["red": 178.0, "green": 25.0, "blue": 25.0, "alpha": 1.0],
      "titleColor": ["red": 255.0, "green": 255.0, "blue": 255.0, "alpha": 1.0],
      "subtitleColor": ["red": 230.0, "green": 230.0, "blue": 230.0, "alpha": 1.0],
      "primaryButtonLabelColor": ["red": 255.0, "green": 255.0, "blue": 255.0, "alpha": 1.0],
      "primaryButtonBackgroundColor": ["red": 51.0, "green": 153.0, "blue": 51.0, "alpha": 1.0],
      "secondaryButtonLabelColor": ["red": 100.0, "green": 100.0, "blue": 100.0, "alpha": 1.0],
    ]

    // iOS 26.5+ opens Bittersweet directly (ShieldActionResponse
    // .openParentalControlsApp); below that the shield closes and posts a
    // notification the user taps. ShieldActionExtension picks the path with
    // #available and skips the fallback action when it can open directly.
    // Mirrors configureShield() in src/modules/BitterSweetFamilyControls.ts.
    let shieldActions: [String: Any] = [
      "primary": [
        "behavior": "openParentalControlsApp",
        "actions": [
          [
            "type": "sendNotification",
            "isOpenAppFallback": true,
            "payload": [
              "title": strings["unlockNotificationTitle"] ?? "Unlock this app?",
              "body": strings["unlockNotificationBody"] ?? "Tap to open Bittersweet and spend fruits.",
              "sound": "default",
              "interruptionLevel": "active",
              "userInfo": ["source": "shieldAction"],
            ] as [String: Any],
          ] as [String: Any]
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
    let strings = getShieldStrings()

    let shieldConfig: [String: Any] = [
      "title": strings["title"] ?? "{applicationOrDomainDisplayName} is Blocked",
      "subtitle": strings["focusSubtitle"] ?? "Focus session in progress\nStay focused!",
      "primaryButtonLabel": strings["closeButton"] ?? "Close",
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
    WidgetCenter.shared.reloadTimelines(ofKind: "com.path2us.bittersweet.GoalWidget")
    WidgetCenter.shared.reloadTimelines(ofKind: "com.path2us.bittersweet.SmallTodoWidget")
    WidgetCenter.shared.reloadTimelines(ofKind: "com.path2us.bittersweet.MediumTodoWidget")
  }
}
