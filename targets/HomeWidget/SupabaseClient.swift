import Foundation

/// Lightweight Supabase REST client for native intents (widget/Live Activity).
/// All methods are fire-and-forget — errors are logged but never propagated.
/// This ensures the intent always completes quickly regardless of network state.
@available(iOS 17.0, *)
enum SupabaseClient {
  private static let supabaseUrl = "https://wpcyvjpntzgfpwbzprkp.supabase.co"
  private static let supabaseAnonKey = "sb_publishable_aMzfr3VTL7lOhfYKqOniEA_SyAHaDhY"

  // MARK: - Helpers

  private static func credentials() -> (userId: String, accessToken: String)? {
    let manager = WidgetDataManager.shared
    guard let userId = manager.getSupabaseUserId(),
          let token = manager.getSupabaseAccessToken(),
          !userId.isEmpty, !token.isEmpty else {
      return nil
    }
    return (userId, token)
  }

  private static func makeRequest(
    path: String,
    method: String,
    body: [String: Any]?,
    accessToken: String,
    extraHeaders: [String: String] = [:]
  ) -> URLRequest? {
    guard let url = URL(string: "\(supabaseUrl)\(path)") else { return nil }

    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    for (key, value) in extraHeaders {
      request.setValue(value, forHTTPHeaderField: key)
    }

    if let body = body {
      request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    }

    return request
  }

  private static func fire(_ request: URLRequest, label: String, completion: (() -> Void)? = nil) {
    URLSession.shared.dataTask(with: request) { _, response, error in
      if let error = error {
        print("⚡️ [SupabaseClient] \(label) failed: \(error.localizedDescription)")
        return
      }
      if let httpResponse = response as? HTTPURLResponse,
         !(200...299).contains(httpResponse.statusCode) {
        print("⚡️ [SupabaseClient] \(label) HTTP \(httpResponse.statusCode)")
      } else {
        print("⚡️ [SupabaseClient] \(label) succeeded")
        completion?()
      }
    }.resume()
  }

  // MARK: - Public Methods

  /// Update `is_focusing` on the user's grove_profiles row.
  /// Respects `show_live_status` privacy setting — skips if false and setting to true.
  static func setFocusing(_ isFocusing: Bool) {
    guard let creds = credentials() else { return }

    // If setting to true, respect privacy: skip if showLiveStatus is off
    if isFocusing && !WidgetDataManager.shared.getGroveShowLiveStatus() {
      print("⚡️ [SupabaseClient] setFocusing skipped — showLiveStatus is off")
      return
    }

    let path = "/rest/v1/grove_profiles?user_id=eq.\(creds.userId)"
    let body: [String: Any] = [
      "is_focusing": isFocusing,
      "updated_at": ISO8601DateFormatter().string(from: Date()),
    ]

    guard let request = makeRequest(
      path: path,
      method: "PATCH",
      body: body,
      accessToken: creds.accessToken
    ) else { return }

    fire(request, label: "setFocusing(\(isFocusing))")
  }

  /// Insert a completed focus session into `focus_sessions`.
  /// Uses upsert (merge-duplicates) so double-writes from JS foreground are harmless.
  static func recordSession(
    sessionId: String,
    tagId: String,
    tagName: String,
    tagIcon: String,
    tagColor: String,
    duration: Int,
    startTime: Double,
    endTime: Double
  ) {
    guard let creds = credentials() else { return }

    let startDate = Date(timeIntervalSince1970: startTime / 1000)
    let endDate = Date(timeIntervalSince1970: endTime / 1000)
    let formatter = ISO8601DateFormatter()

    let tagBody: [String: Any] = [
      "id": tagId,
      "user_id": creds.userId,
      "name": tagName.isEmpty ? "Focus" : tagName,
      "icon": tagIcon,
      "color": tagColor.isEmpty ? "#6592E9" : tagColor,
      "updated_at": formatter.string(from: Date()),
    ]

    let sessionBody: [String: Any] = [
      "id": sessionId,
      "user_id": creds.userId,
      "tag_id": tagId,
      "duration": duration,
      "initial_set_duration": duration,
      "actual_duration": duration,
      "start_time": formatter.string(from: startDate),
      "end_time": formatter.string(from: endDate),
      "is_manual_entry": false,
    ]

    guard let tagRequest = makeRequest(
      path: "/rest/v1/session_tags",
      method: "POST",
      body: tagBody,
      accessToken: creds.accessToken,
      extraHeaders: ["Prefer": "resolution=merge-duplicates"]
    ) else { return }

    guard let sessionRequest = makeRequest(
      path: "/rest/v1/focus_sessions",
      method: "POST",
      body: sessionBody,
      accessToken: creds.accessToken,
      extraHeaders: ["Prefer": "resolution=merge-duplicates"]
    ) else { return }

    fire(tagRequest, label: "upsertSessionTag(\(tagId))") {
      fire(sessionRequest, label: "recordSession(\(sessionId))")
    }
  }

  /// Patch a todo's completed state in `todos`. Mirrors the JS todoToRow columns
  /// (completed / completed_at / updated_at) so the JS adoption write and this
  /// native write collapse to one row (upsert by id, last-write-wins).
  static func setTodoCompleted(todoId: String, completed: Bool) {
    guard let creds = credentials() else { return }
    guard !todoId.isEmpty else { return }

    let nowStr = ISO8601DateFormatter().string(from: Date())
    let body: [String: Any] = [
      "completed": completed,
      "completed_at": completed ? nowStr : NSNull(),
      "updated_at": nowStr,
    ]

    guard let request = makeRequest(
      path: "/rest/v1/todos?id=eq.\(todoId)",
      method: "PATCH",
      body: body,
      accessToken: creds.accessToken
    ) else { return }

    fire(request, label: "setTodoCompleted(\(todoId), \(completed))")
  }

  // MARK: - Remote (desktop-driven) Sessions — Phase 4

  /// One row of `active_sessions`, the live-session record the desktop client
  /// writes. Only the fields the widget acts on are decoded.
  struct ActiveSession {
    let sessionId: String
    let tagId: String
    let startedAtMs: Double
    let endedAt: Bool
    let targetMinutes: Int
    let origin: String
  }

  /// Read the user's live session record.
  ///
  /// Unlike everything else here this is awaited rather than fired and
  /// forgotten: the widget's timeline provider has to know the answer before it
  /// can build an entry, and a timeline built against last hour's state is the
  /// bug this whole path exists to fix. Returns nil on any failure — no
  /// credentials, no network, no row — and every caller treats nil as "leave
  /// local state exactly as it is".
  static func fetchActiveSession() async -> ActiveSession? {
    guard let creds = credentials() else { return nil }

    let path = "/rest/v1/active_sessions"
      + "?user_id=eq.\(creds.userId)"
      + "&select=session_id,tag_id,started_at,ended_at,target_minutes,origin"
      + "&limit=1"

    guard let request = makeRequest(
      path: path,
      method: "GET",
      body: nil,
      accessToken: creds.accessToken
    ) else { return nil }

    do {
      let (data, response) = try await URLSession.shared.data(for: request)
      if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
        print("⚡️ [SupabaseClient] fetchActiveSession HTTP \(http.statusCode)")
        return nil
      }
      guard let rows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]],
            let row = rows.first,
            let sessionId = row["session_id"] as? String,
            let tagId = row["tag_id"] as? String,
            let startedAt = row["started_at"] as? String,
            let origin = row["origin"] as? String else {
        return nil
      }
      guard let startedDate = parsePostgresTimestamp(startedAt) else { return nil }

      // A running session has ended_at JSON null, which decodes to NSNull rather
      // than to a missing key — treating NSNull as "present" would read every
      // live session as already finished.
      let endedAtValue = row["ended_at"]
      let hasEnded = endedAtValue != nil && !(endedAtValue is NSNull)

      return ActiveSession(
        sessionId: sessionId,
        tagId: tagId,
        startedAtMs: startedDate.timeIntervalSince1970 * 1000,
        endedAt: hasEnded,
        targetMinutes: row["target_minutes"] as? Int ?? 0,
        origin: origin
      )
    } catch {
      print("⚡️ [SupabaseClient] fetchActiveSession failed: \(error.localizedDescription)")
      return nil
    }
  }

  /// Postgres hands back `2026-08-21T09:14:22.117+00:00`, whose fractional
  /// seconds `ISO8601DateFormatter` rejects unless explicitly told to expect
  /// them — and it is not always present. Try both rather than lose the row.
  private static func parsePostgresTimestamp(_ value: String) -> Date? {
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = withFraction.date(from: value) { return date }
    return ISO8601DateFormatter().date(from: value)
  }

  /// Mark the live session finished. Idempotent: the RPC no-ops when nothing is
  /// running, so it is safe to call on every stop regardless of who started it.
  ///
  /// This is what lets the Live Activity's End button stop a session the desktop
  /// started. On a push-started card the phone has no local session at all, so
  /// the rest of StopSessionIntent's Supabase work is (correctly) skipped —
  /// without this call the desktop would keep showing a timer the user just
  /// ended from their Lock Screen.
  static func stopActiveSession() {
    guard let creds = credentials() else { return }

    guard let request = makeRequest(
      path: "/rest/v1/rpc/stop_active_session",
      method: "POST",
      body: ["p_stopped_by": "ios"],
      accessToken: creds.accessToken
    ) else { return }

    fire(request, label: "stopActiveSession()")
  }

  /// File the WidgetKit push token so `session-remote-control` can wake this
  /// widget extension.
  ///
  /// JS does this too (WidgetPushService) and is the more reliable path — it has
  /// a real runtime and can retry. This copy exists for the case JS can't cover:
  /// the token changes (a widget is added, or iOS rotates it) on a phone whose
  /// app is never reopened, which is exactly the phone that needs remote control.
  ///
  /// `bundleId` is the *app's*, not this extension's — the APNs topic is
  /// `<app bundle id>.push-type.widgets`, and pushing at the extension's own id
  /// gets 400 TopicDisallowed.
  static func upsertWidgetPushToken(_ token: String) {
    guard let creds = credentials() else { return }
    guard let bundleId = containingAppBundleId() else { return }

    let body: [String: Any] = [
      "user_id": creds.userId,
      "kind": "widget",
      "token": token,
      "bundle_id": bundleId,
      "updated_at": ISO8601DateFormatter().string(from: Date()),
    ]

    guard let request = makeRequest(
      path: "/rest/v1/device_push_tokens",
      method: "POST",
      body: body,
      accessToken: creds.accessToken,
      extraHeaders: ["Prefer": "resolution=merge-duplicates"]
    ) else { return }

    fire(request, label: "upsertWidgetPushToken()")
  }

  /// The bundle identifier of the app hosting this extension.
  ///
  /// `Bundle.main` inside an extension is the `.appex`, so its identifier is
  /// `<app id>.bittersweetmobileLiveActivity`. The containing app sits two
  /// directories up (`App.app/PlugIns/Ext.appex`); reading its Info.plist is
  /// exact, where string-trimming the suffix only works by convention.
  private static func containingAppBundleId() -> String? {
    let appBundleUrl = Bundle.main.bundleURL
      .deletingLastPathComponent()
      .deletingLastPathComponent()
    if let identifier = Bundle(url: appBundleUrl)?.bundleIdentifier {
      return identifier
    }
    // Fallback for the main-app target, where Bundle.main already IS the app.
    return Bundle.main.bundleIdentifier
  }

  /// Record challenge progress via the server-side RPC.
  /// The RPC is idempotent (returns `already_logged` if day was already recorded).
  static func recordChallengeProgress(challengeId: String) {
    guard let creds = credentials() else { return }

    let body: [String: Any] = [
      "challenge_id": challengeId,
    ]

    guard let request = makeRequest(
      path: "/rest/v1/rpc/record_challenge_progress",
      method: "POST",
      body: body,
      accessToken: creds.accessToken
    ) else { return }

    fire(request, label: "recordChallengeProgress(\(challengeId))")
  }
}
