import AppIntents
import CoreMotion
import Foundation
import UserNotifications
import WidgetKit

// MARK: - Start Session Intent
// Conforms to LiveActivityIntent so the system runs perform() in the main app
// process, where Activity.request() works. The widget extension also compiles
// this file but the system only executes the main app's copy.
//
// ActivityKit calls are in a separate file (SessionIntentActivityKit.swift)
// that is only compiled in the main app target, because LiveActivityAttributes
// is internal to the ExpoLiveActivity module and not visible from the main app target
// via direct import. The widget extension target has its own copy via LiveActivityWidget.swift.

// Callback hooks for ActivityKit — set by WidgetActivityKitLoader in SessionIntentActivityKit.swift
// (main app target only). In the widget extension, these stay nil and registerIfNeeded() is a no-op
// because the loader class doesn't exist there.
@available(iOS 17.0, *)
enum WidgetActivityKit {
  nonisolated(unsafe) static var startHandler: ((String, Int, Double, Double, Bool) -> String?)? = nil
  nonisolated(unsafe) static var stopHandler: (() -> Void)? = nil
  nonisolated(unsafe) static var reblockHandler: (() -> Void)? = nil

  /// Lazily registers ActivityKit handlers by dynamically discovering WidgetActivityKitLoader
  /// via the ObjC runtime. In the widget extension, the class doesn't exist so this is a no-op.
  /// In the main app, it calls registerHandlers() which sets the start/stop closures.
  static func registerIfNeeded() {
    guard startHandler == nil else { return }
    guard let loaderClass = NSClassFromString("WidgetActivityKitLoader") as? NSObject.Type else { return }
    loaderClass.perform(NSSelectorFromString("registerHandlers"))
  }
}

// Compact time-ordered id matching the JS generateId() in store/index.ts:
// base36 ms timestamp + "-" + 10 random base36 chars. All focus_sessions ids
// share this format so the text PK stays small and inserts land at the right
// edge of the Postgres B-tree. Keep in sync with the JS generator.
func generateCompactId() -> String {
  let timestamp = String(Int64(Date().timeIntervalSince1970 * 1000), radix: 36)
  let alphabet = Array("0123456789abcdefghijklmnopqrstuvwxyz")
  let random = String((0..<10).map { _ in alphabet.randomElement()! })
  return "\(timestamp)-\(random)"
}

@available(iOS 17.0, *)
struct StartSessionIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Start Focus Session"
  static var description: IntentDescription = "Starts a focus session for a tag"

  // Siri / Shortcuts surface: the spoken or picked tag. Widgets and Live Activity
  // buttons don't set this — they pass `tagId` via init(tagId:duration:) instead.
  @Parameter(title: "Focus Tag")
  var tag: TagEntity?

  @Parameter(title: "Tag ID")
  var tagId: String?

  @Parameter(title: "Duration")
  var duration: Int?

  static var parameterSummary: some ParameterSummary {
    Summary("Start focus for \(\.$tag) for \(\.$duration) minutes")
  }

  init() {}

  init(tagId: String?, duration: Int?) {
    self.tagId = tagId
    self.duration = duration
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    // Ensure ActivityKit handlers are registered (main app target only; no-op in widget extension)
    WidgetActivityKit.registerIfNeeded()

    // Guard: don't double-start if a session is already active
    if let session = WidgetDataManager.shared.getSessionData(), session.isActive {
      return .result(dialog: "A focus session is already running.")
    }

    // Guard: don't start a focus session during an active unlock
    if let unlock = WidgetDataManager.shared.getUnlockSessionData(), unlock.isActive {
      return .result(dialog: "Can't start while apps are unlocked.")
    }

    // Resolve the tag from the Siri entity (tag) or the widget-supplied tagId.
    // No default-tag fallback: an unknown/missing id is a clean no-op, so Siri or a
    // stale shortcut never silently starts an arbitrary tag.
    let tags = WidgetDataManager.shared.getTagList()
    let effectiveId = tag?.id ?? tagId
    guard let resolvedTag = tags.first(where: { $0.id == effectiveId }) else {
      return .result(dialog: "That focus tag isn't available.")
    }

    let resolvedDuration = duration ?? resolvedTag.lastDuration ?? 15
    let isInfinite = resolvedDuration == 0
    let now = Date().timeIntervalSince1970 * 1000
    let startTimeMs = now
    let endTimeMs = isInfinite ? 0 : now + Double(resolvedDuration) * 60 * 1000

    // Begin recording raw accelerometer for the session so the app can suggest a
    // focus rating when the session ends. Best-effort; silently no-ops if Motion
    // access isn't available/authorized. Runs in the main app process (this
    // intent is a LiveActivityIntent), where CMSensorRecorder is meaningful.
    if CMSensorRecorder.isAccelerometerRecordingAvailable() {
      let recordSeconds = isInfinite ? 12.0 * 60 * 60 : Double(resolvedDuration) * 60
      CMSensorRecorder().recordAccelerometer(forDuration: recordSeconds)
    }

    // Start Live Activity (runs in main app process via LiveActivityIntent)
    let tagLabel = "\(resolvedTag.icon.isEmpty ? "🎯" : resolvedTag.icon) \(resolvedTag.name)"
    let liveActivityId = WidgetActivityKit.startHandler?(
      tagLabel, resolvedDuration, startTimeMs, endTimeMs, isInfinite
    )

    // Update widget display
    WidgetDataManager.shared.writeSessionData(
      isActive: true,
      tagId: resolvedTag.id,
      tagName: resolvedTag.name,
      tagIcon: resolvedTag.icon,
      tagColor: resolvedTag.color,
      startTime: startTimeMs,
      endTime: endTimeMs,
      isInfinite: isInfinite
    )

    // Write session info for JS adoption when app opens
    WidgetDataManager.shared.writeWidgetStartedSession(
      tagId: resolvedTag.id,
      tagName: resolvedTag.name,
      tagIcon: resolvedTag.icon,
      tagColor: resolvedTag.color,
      duration: resolvedDuration,
      startTime: startTimeMs,
      endTime: endTimeMs,
      isInfinite: isInfinite,
      liveActivityId: liveActivityId
    )

    // Set shield to focus mode so blocked apps show "Focus session in progress"
    // instead of the unlock button. JS will also set this on adoption, but we
    // set it here for immediate effect when starting from the widget.
    WidgetDataManager.shared.setShieldForFocusMode()

    // Notify friends immediately via Supabase (fire-and-forget)
    SupabaseClient.setFocusing(true)

    WidgetDataManager.shared.reloadTimelines()

    let confirmation: String = isInfinite
      ? "Started \(resolvedTag.name)."
      : "Started \(resolvedTag.name) for \(resolvedDuration) minutes."
    return .result(dialog: IntentDialog(stringLiteral: confirmation))
  }
}

// MARK: - Tag Entity (Siri / Shortcuts)

// Exposes focus tags as an AppEntity so they can be a spoken/picked parameter for
// Siri ("Start a Reading focus session"). Defined here because SessionIntent.swift
// compiles into both the main app and widget extension targets, so the entity is
// visible wherever StartSessionIntent is.
@available(iOS 17.0, *)
struct TagEntity: AppEntity {
  let id: String
  let name: String
  let icon: String
  let color: String
  let lastDuration: Int?

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Focus Tag"
  static var defaultQuery = TagEntityQuery()

  // Plain name is the spoken/matched title — emoji icons don't voice-match well.
  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(name)")
  }

  init(id: String, name: String, icon: String, color: String, lastDuration: Int?) {
    self.id = id
    self.name = name
    self.icon = icon
    self.color = color
    self.lastDuration = lastDuration
  }

  init(from tag: WidgetTagInfo) {
    self.init(
      id: tag.id, name: tag.name, icon: tag.icon, color: tag.color, lastDuration: tag.lastDuration
    )
  }
}

@available(iOS 17.0, *)
struct TagEntityQuery: EntityQuery, EntityStringQuery {
  // Resolve specific tags by id (e.g. when restoring a saved shortcut's parameter).
  func entities(for identifiers: [String]) async throws -> [TagEntity] {
    let tags = WidgetDataManager.shared.getTagList()
    return tags.filter { identifiers.contains($0.id) }.map(TagEntity.init(from:))
  }

  // The set of tags Siri enumerates for the spoken `${tag}` slot / Shortcuts picker.
  func suggestedEntities() async throws -> [TagEntity] {
    WidgetDataManager.shared.getTagList().map(TagEntity.init(from:))
  }

  // In-app Shortcuts search: match a typed/spoken string against tag names.
  func entities(matching string: String) async throws -> [TagEntity] {
    let needle = string.lowercased()
    return WidgetDataManager.shared.getTagList()
      .filter { $0.name.lowercased().contains(needle) }
      .map(TagEntity.init(from:))
  }
}

// MARK: - Stop Session Intent

@available(iOS 17.0, *)
struct StopSessionIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stop Focus Session"
  static var description: IntentDescription = "Stops the current focus session"

  init() {}

  func perform() async throws -> some IntentResult {
    // Ensure ActivityKit handlers are registered (main app target only; no-op in widget extension)
    WidgetActivityKit.registerIfNeeded()

    // Stop all Live Activities (runs in main app process via LiveActivityIntent)
    WidgetActivityKit.stopHandler?()

    // Cancel the JS-scheduled completion notification immediately so it doesn't
    // fire after the session is stopped (JS can't cancel it until app foregrounds)
    if let notificationId = WidgetDataManager.shared.getAndClearScheduledNotificationId() {
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [notificationId])
    }

    // NOTE: Do NOT clear widgetStartedSession here. The JS side needs it to
    // record the completed session in adoptAndRecoverSession(). It will be
    // cleared there after being read (index.tsx: adoptAndRecoverSession).

    // Capture the active session BEFORE we overwrite it with idle data below.
    // This is driven off sessionData, which is always written regardless of
    // whether the session was started from the app or the widget — unlike
    // widgetStartedSession, which only exists for widget-started sessions.
    let active = WidgetDataManager.shared.getSessionData()
    let stopTimestamp = Date().timeIntervalSince1970 * 1000

    // One id for this completed session, shared by the native Supabase write and
    // the JS adoption write (passed via the stop marker). focus_sessions upserts
    // by id, so both writes collapse to a single row instead of duplicating.
    let sessionId = generateCompactId()

    // Reflect the finished session in the goal widget immediately. Floor to match
    // the minutes the session is actually recorded with, so the bump equals what
    // the JS goal recompute will later attribute to this session. JS recomputes
    // every goal from scratch on next foreground and corrects any drift.
    if let active = active, active.isActive {
      let durationMinutes = Double(Int((stopTimestamp - active.startTime) / 60000))
      WidgetDataManager.shared.addSessionMinutesToGoal(tagId: active.tagId, minutes: durationMinutes)
    }

    // Write idle session data for widget display
    WidgetDataManager.shared.writeSessionData(
      isActive: false,
      tagId: "",
      tagName: "",
      tagIcon: "",
      tagColor: "",
      startTime: 0,
      endTime: 0,
      isInfinite: false
    )

    // Write stop marker for JS to record the completed session. Carries the
    // sessionId so JS adopts the same id the native Supabase write used.
    WidgetDataManager.shared.writeWidgetStopAction(
      timestamp: stopTimestamp,
      sessionId: sessionId
    )

    // Restore shield to non-focus mode so users can unlock apps with fruits.
    // JS won't run until the app foregrounds, so we update the shield config
    // directly from native to avoid the shield staying stuck in focus mode.
    WidgetDataManager.shared.restoreShieldForNonFocusMode()

    // --- Supabase sync (fire-and-forget) ---
    // Clear focusing status immediately so friends see the user is done
    SupabaseClient.setFocusing(false)

    // Best-effort record of the completed session straight from native, so it
    // survives even if the app is never reopened (e.g. user deletes it after
    // ending from the widget/Live Activity). Driven off sessionData so it covers
    // BOTH app-started and widget-started sessions. The upsert merges with the
    // JS adoption write (same sessionId) when the app is reopened normally.
    if let active = active, active.isActive {
      let durationMinutes = Int((stopTimestamp - active.startTime) / 60000)

      if durationMinutes > 0, !active.tagId.isEmpty {
        SupabaseClient.recordSession(
          sessionId: sessionId,
          tagId: active.tagId,
          tagName: active.tagName,
          tagIcon: active.tagIcon,
          tagColor: active.tagColor,
          duration: durationMinutes,
          startTime: active.startTime,
          endTime: stopTimestamp
        )

        // Record challenge progress for any active challenge matching this tag
        let activeChallenges = WidgetDataManager.shared.getGroveActiveChallenges()
        for challenge in activeChallenges {
          if challenge["tagId"] == active.tagId, let challengeId = challenge["id"] {
            SupabaseClient.recordChallengeProgress(challengeId: challengeId)
          }
        }
      }
    }

    WidgetDataManager.shared.reloadTimelines()

    return .result()
  }
}

// MARK: - Stop Unlock Intent

@available(iOS 17.0, *)
struct StopUnlockIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Stop Unlock Session"
  static var description: IntentDescription = "Stops the current unlock session and re-blocks apps"

  init() {}

  func perform() async throws -> some IntentResult {
    // Ensure ActivityKit handlers are registered (main app target only; no-op in widget extension)
    WidgetActivityKit.registerIfNeeded()

    // Transition Live Activity to idle focus state (reuse existing stop handler)
    WidgetActivityKit.stopHandler?()

    // Re-block apps immediately via ManagedSettingsStore (main app process only)
    WidgetActivityKit.reblockHandler?()

    // Cancel the JS-scheduled "Unblock Expired" notification immediately so it
    // doesn't fire after the unlock is ended (JS can't cancel it until the app
    // foregrounds). Without this, the stale notification still fires and its
    // handler ends the session as 'expired' — skipping the fruit refund. Mirrors
    // StopSessionIntent. The ID is written to UserDefaults by UnlockSnackbar.
    if let notificationId = WidgetDataManager.shared.getAndClearScheduledNotificationId() {
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [notificationId])
    }

    // Clear unlock state so widget immediately shows idle
    WidgetDataManager.shared.clearUnlockSessionData()

    // Write unlock stop marker for JS to end the unlock session
    // (refund fruits, update Zustand state)
    WidgetDataManager.shared.writeWidgetUnlockStopAction(
      timestamp: Date().timeIntervalSince1970 * 1000
    )

    // Restore shield to non-focus mode so blocked apps show the unlock UI
    WidgetDataManager.shared.restoreShieldForNonFocusMode()

    WidgetDataManager.shared.reloadTimelines()

    return .result()
  }
}

// MARK: - Widget Configuration Enums

@available(iOS 17.0, *)
enum TagSortOrder: String, AppEnum {
  case currentOrder
  case recent

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Sort Order"

  static var caseDisplayRepresentations: [TagSortOrder: DisplayRepresentation] = [
    .currentOrder: "Current Order",
    .recent: "Recent",
  ]
}

@available(iOS 17.0, *)
enum TagGridSize: String, AppEnum {
  case two
  case four

  static var typeDisplayRepresentation: TypeDisplayRepresentation = "Tags Shown"

  static var caseDisplayRepresentations: [TagGridSize: DisplayRepresentation] = [
    .two: "2 Tags",
    .four: "4 Tags",
  ]
}

// MARK: - Medium Widget Configuration Intent

@available(iOS 17.0, *)
struct SelectGridIntent: WidgetConfigurationIntent {
  static var title: LocalizedStringResource = "Configure Focus Grid"
  static var description: IntentDescription = "Choose how tags are displayed"

  @Parameter(title: "Sort By", default: .currentOrder)
  var sortOrder: TagSortOrder?

  @Parameter(title: "Tags Shown", default: .four)
  var gridSize: TagGridSize?

  init() {}
}
