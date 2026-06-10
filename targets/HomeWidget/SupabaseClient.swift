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
