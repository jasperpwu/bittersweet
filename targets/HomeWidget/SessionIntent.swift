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

@available(iOS 17.0, *)
struct StartSessionIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Start Focus Session"
  static var description: IntentDescription = "Starts a focus session with the configured tag"

  @Parameter(title: "Tag ID")
  var tagId: String?

  @Parameter(title: "Duration")
  var duration: Int?

  init() {}

  init(tagId: String?, duration: Int?) {
    self.tagId = tagId
    self.duration = duration
  }

  func perform() async throws -> some IntentResult {
    // Ensure ActivityKit handlers are registered (main app target only; no-op in widget extension)
    WidgetActivityKit.registerIfNeeded()

    // Guard: don't double-start if a session is already active
    if let session = WidgetDataManager.shared.getSessionData(), session.isActive {
      return .result()
    }

    // Guard: don't start a focus session during an active unlock
    if let unlock = WidgetDataManager.shared.getUnlockSessionData(), unlock.isActive {
      return .result()
    }

    let tags = WidgetDataManager.shared.getTagList()
    let tag = tagId.flatMap { id in tags.first(where: { $0.id == id }) } ?? tags.first

    guard let tag = tag else {
      return .result()
    }

    let resolvedDuration = duration ?? tag.lastDuration ?? 15
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
    let tagLabel = "\(tag.icon.isEmpty ? "🎯" : tag.icon) \(tag.name)"
    let liveActivityId = WidgetActivityKit.startHandler?(
      tagLabel, resolvedDuration, startTimeMs, endTimeMs, isInfinite
    )

    // Update widget display
    WidgetDataManager.shared.writeSessionData(
      isActive: true,
      tagId: tag.id,
      tagName: tag.name,
      tagIcon: tag.icon,
      tagColor: tag.color,
      startTime: startTimeMs,
      endTime: endTimeMs,
      isInfinite: isInfinite
    )

    // Write session info for JS adoption when app opens
    WidgetDataManager.shared.writeWidgetStartedSession(
      tagId: tag.id,
      tagName: tag.name,
      tagIcon: tag.icon,
      tagColor: tag.color,
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

    return .result()
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
    let sessionId = UUID().uuidString

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
