import AppIntents
import WidgetKit

// MARK: - Toggle TODO Intent
//
// Runs in the widget extension process when the user taps a TODO's checkbox on
// the Home Screen. Unlike StartSessionIntent this is a plain AppIntent (no
// ActivityKit), so it doesn't need to run in the main app process.
//
// The widget only ever shows incomplete todos, so a tap always means "mark done".
// We persist straight to Supabase (so the change survives even if the app is
// never reopened), queue a marker for JS to adopt into the Zustand store on next
// foreground, and drop the row from the snapshot so it disappears immediately.

@available(iOS 17.0, *)
struct ToggleTodoIntent: AppIntent {
  static var title: LocalizedStringResource = "Complete TODO"
  static var description: IntentDescription = "Marks a TODO as done"

  @Parameter(title: "Todo ID")
  var id: String

  init() {}

  init(id: String) {
    self.id = id
  }

  func perform() async throws -> some IntentResult {
    guard !id.isEmpty else { return .result() }

    // Persist to Supabase (fire-and-forget) so it survives without app reopen.
    SupabaseClient.setTodoCompleted(todoId: id, completed: true)

    // Queue for JS adoption + optimistically remove from the widget snapshot.
    WidgetDataManager.shared.appendTodoToggle(id: id, completed: true)

    WidgetDataManager.shared.reloadTimelines()

    return .result()
  }
}

// MARK: - Open New TODO Intent
//
// Backs the "+" button on the TODO widget. `openAppWhenRun` brings the app to
// the foreground; we leave a marker in shared UserDefaults that JS reads on
// foreground/launch and uses to navigate to the Journal tab and open the new
// TODO modal. (Small widgets can't deep-link a sub-region via Link — only via
// an interactive intent button — so this works across both widget sizes.)

@available(iOS 17.0, *)
struct OpenNewTodoIntent: AppIntent {
  static var title: LocalizedStringResource = "New TODO"
  static var description: IntentDescription = "Opens Bittersweet to create a new TODO"
  static var openAppWhenRun: Bool = true

  init() {}

  func perform() async throws -> some IntentResult {
    WidgetDataManager.shared.requestOpenNewTodo()
    return .result()
  }
}
