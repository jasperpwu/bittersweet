import Foundation
import WidgetKit

// Phase 4 — remote shield control.
//
// Phases 2 and 3 can already make the phone follow a desktop session while the
// app is running (Realtime) and mirror its timer on the Lock Screen while the app
// is closed (ActivityKit push). Neither can touch the *shield*: a Realtime socket
// dies with the app, and a Live Activity push is rendered by ActivityKit without
// ever running our code. So a session started from the laptop left the shield
// showing its idle "unlock for N fruits" copy, and the user could buy their way
// out of a session the desktop believed was running.
//
// WidgetKit push (iOS 26) is the one mechanism that gets our own code running on
// a force-quit phone without a user-visible notification. It wakes the widget
// extension — a system-hosted process — and reloads its timelines. This file is
// what runs at that moment.
//
// WHAT THIS DOES NOT NEED, contrary to the original Phase 4 sketch: the
// `family-controls` entitlement. Blocking in this app is persistent rather than
// per-session — react-native-device-activity keeps a saved blocklist and the
// ManagedSettingsStore tokens stay applied whether or not a session is running
// (see updateBlockInternal in its Shared.swift). What changes when a session
// starts is the shield's *configuration*: title, subtitle, and whether the
// primary button offers "Unlock App" or just closes. That config is a plain
// UserDefaults blob in the app group, read by the already-entitled
// ShieldConfiguration extension when it draws the shield. Writing it needs no
// Screen Time entitlement at all, which also means no new Family Controls
// (Distribution) request for the widget's bundle ID.
//
// Only `origin == 'desktop'` rows are ever acted on, matching
// hasRunningDesktopSession() in app/_layout.tsx. A session this phone started is
// already reflected locally, and mirroring it back would fight the local writes.

// MARK: - Push token

/// Receives the WidgetKit push token and files it so `session-remote-control`
/// can address this extension.
///
/// Apple: "you can't use the User Notifications framework to register your widget
/// for push notifications. Instead, you use WidgetKit to obtain a push token."
/// That is the reason this mechanism was chosen — it is not gated on
/// notification authorization, which this app's users routinely deny.
///
/// The system calls this for the first token and for every change, including
/// when the user adds or removes a widget.
@available(iOS 26.0, *)
struct FocusWidgetPushHandler: WidgetPushHandler {
  init() {}

  func pushTokenDidChange(_ pushInfo: WidgetPushInfo, widgets: [WidgetInfo]) {
    let token = pushInfo.token.map { String(format: "%02x", $0) }.joined()

    // Unchanged tokens arrive on every widget add/remove. Skip the upload, but
    // still let JS re-file it later — the row may belong to a different account.
    guard WidgetDataManager.shared.writeWidgetPushToken(token) else { return }

    // Best-effort direct upload. This is the only path that works on a phone
    // whose app is never reopened; WidgetPushService covers the reliable case.
    SupabaseClient.upsertWidgetPushToken(token)
  }
}

// MARK: - Applying the remote session

// @MainActor for one reason: `inFlight` below is mutable static state touched
// from whichever task a timeline reload happens to run on, and an unsynchronized
// read/write of a reference-typed optional risks an over-release rather than
// merely a duplicated request. Isolating the whole enum serializes it for free.
// Nothing here is expensive on the main actor — one awaited URLSession call and a
// handful of UserDefaults writes.
@available(iOS 17.0, *)
@MainActor
enum RemoteSessionSync {
  /// A push reloads *every* widget kind at once, so five providers ask this
  /// question within milliseconds of each other. The first one through does the
  /// request; the rest read what it wrote.
  private static let minimumCheckInterval: TimeInterval = 5

  /// The same eight-hour bound `hasRunningDesktopSession` uses in _layout.tsx.
  /// ActivityKit ends a Live Activity at eight hours, and the shield must not
  /// outlive the card representing the session: past that the row is a leftover
  /// from a desktop that never wrote its stop, and a shield stuck in focus mode
  /// can never be unlocked from this phone.
  private static let maximumSessionAge: TimeInterval = 8 * 60 * 60

  /// In-process dedupe for the concurrent case the UserDefaults throttle can't
  /// see: providers that call in during the *same* request, before it has
  /// stamped the clock.
  private static var inFlight: Task<Void, Never>?

  /// Reconcile local app-group state with the desktop's live session record.
  ///
  /// Awaited from the timeline providers, so an entry built after this call sees
  /// the session the push was announcing. Cheap and safe to call on every
  /// reload: it short-circuits before touching the network when the user isn't
  /// signed in or when another provider just checked.
  static func refreshIfNeeded() async {
    if let existing = inFlight {
      await existing.value
      return
    }

    guard WidgetDataManager.shared.getSupabaseUserId() != nil else { return }
    guard WidgetDataManager.shared.claimRemoteSessionCheck(minimumInterval: minimumCheckInterval) else {
      return
    }

    let task = Task { await refresh() }
    inFlight = task
    await task.value
    inFlight = nil
  }

  private static func refresh() async {
    let remote = await SupabaseClient.fetchActiveSession()
    apply(remote)
  }

  /// Decide what the remote record means for this device, and write it.
  ///
  /// Split out from the fetch so the decision is readable on its own — the
  /// ordering of these guards is the whole safety argument.
  static func apply(_ remote: SupabaseClient.ActiveSession?) {
    let manager = WidgetDataManager.shared
    let mirrored = manager.getRemoteSession()

    // Is the state we last wrote still the state on screen? JS writes the same
    // `widgetSessionData` key when the user starts a session on the phone, so a
    // marker on its own proves nothing; the start time has to match too.
    var mirroredIsOnScreen = false
    if let mirrored = mirrored, let local = manager.getSessionData() {
      mirroredIsOnScreen = local.isActive && local.startTime == mirrored.startTime
    }

    guard let remote = remote, isLiveDesktopSession(remote) else {
      // Nothing live on the desktop. Undo only what we put here — if the user
      // has since started a session on the phone, that state is theirs and the
      // stale marker is simply dropped.
      if mirrored != nil {
        if mirroredIsOnScreen {
          clearMirroredSession()
        } else {
          manager.clearRemoteSession()
        }
      }
      return
    }

    // Already mirroring this exact session — the common case for a routine
    // timeline reload during a desktop session. Re-writing identical state would
    // only churn the app group and force another widget redraw.
    if mirrored?.sessionId == remote.sessionId, mirroredIsOnScreen { return }

    // A session running on THIS phone wins, unless it is the one we mirrored.
    // The user physically pressed start here; losing that to a desktop row is
    // the worse failure — the same call _layout.tsx makes on a start refusal.
    if let local = manager.getSessionData(), local.isActive, !mirroredIsOnScreen { return }

    adoptRemoteSession(remote)
  }

  private static func isLiveDesktopSession(_ session: SupabaseClient.ActiveSession) -> Bool {
    guard session.origin == "desktop", !session.endedAt else { return false }
    let ageSeconds = Date().timeIntervalSince1970 - session.startedAtMs / 1000
    return ageSeconds < maximumSessionAge
  }

  private static func adoptRemoteSession(_ remote: SupabaseClient.ActiveSession) {
    let manager = WidgetDataManager.shared

    // The tag list is synced to the app group by JS, so a tag created on the
    // desktop minutes ago may not be here yet. Fall back to a neutral label
    // rather than dropping the session — the shield state matters more than the
    // widget's wording, and JS corrects the label on next foreground.
    let tag = manager.getTagList().first { $0.id == remote.tagId }

    let isInfinite = remote.targetMinutes <= 0
    let endTimeMs = isInfinite ? 0 : remote.startedAtMs + Double(remote.targetMinutes) * 60_000

    manager.writeSessionData(
      isActive: true,
      tagId: remote.tagId,
      // Literal "Focus", matching SupabaseClient.recordSession's fallback. A
      // localized one would need a new key synced through widgetStrings and a
      // pass over all 13 locales, for a label that only shows in the seconds
      // before JS next syncs the real tag.
      tagName: tag?.name ?? "Focus",
      tagIcon: tag?.icon ?? "\u{1F3AF}",
      tagColor: tag?.color ?? "",
      startTime: remote.startedAtMs,
      endTime: endTimeMs,
      isInfinite: isInfinite
    )

    // The point of the phase: blocked apps now say "Focus session in progress"
    // and offer no fruit buyout, on a phone that never woke up.
    manager.setShieldForFocusMode()
    manager.setRemoteSession(sessionId: remote.sessionId, startTime: remote.startedAtMs)

    // Deliberately NOT writeWidgetStartedSession(). That marker is the JS
    // adoption seam — it makes the app record a completed focus_sessions row on
    // next foreground. The desktop owns the row for a session it started
    // (Phase 2, useActiveSession.stop), and writing one here too would give the
    // user the same session twice.

    print("⚡️ [RemoteSessionSync] adopted desktop session \(remote.sessionId)")
  }

  private static func clearMirroredSession() {
    let manager = WidgetDataManager.shared

    manager.writeSessionData(
      isActive: false,
      tagId: "",
      tagName: "",
      tagIcon: "",
      tagColor: "",
      startTime: 0,
      endTime: 0,
      isInfinite: false
    )

    // Back to the fruit-buyout shield. Leaving focus mode behind would be the
    // worse failure of the two: the user could not unlock anything until the
    // next time they opened the app.
    manager.restoreShieldForNonFocusMode()
    manager.clearRemoteSession()

    print("⚡️ [RemoteSessionSync] cleared mirrored desktop session")
  }
}
