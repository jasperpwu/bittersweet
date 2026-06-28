import SwiftUI
import WidgetKit

// MARK: - Timeline Entry

struct TodoWidgetEntry: TimelineEntry {
  let date: Date
  let items: [WidgetTodoItem]
}

// MARK: - Timeline Provider

struct TodoWidgetProvider: TimelineProvider {
  typealias Entry = TodoWidgetEntry

  func placeholder(in context: Context) -> TodoWidgetEntry {
    TodoWidgetEntry(date: Date(), items: [])
  }

  func getSnapshot(in context: Context, completion: @escaping (TodoWidgetEntry) -> Void) {
    completion(TodoWidgetEntry(date: Date(), items: WidgetDataManager.shared.getTodoList()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodoWidgetEntry>) -> Void) {
    let entry = TodoWidgetEntry(date: Date(), items: WidgetDataManager.shared.getTodoList())
    // Todos are pushed from JS (mount/foreground/mutations) and on each toggle,
    // so a long fallback is enough; nothing is time-sensitive here.
    let refreshDate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date()
    completion(Timeline(entries: [entry], policy: .after(refreshDate)))
  }
}

// MARK: - Widget Definitions

struct SmallTodoWidget: Widget {
  let kind: String = "com.path2us.bittersweet.SmallTodoWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: kind,
      provider: TodoWidgetProvider()
    ) { entry in
      TodoWidgetView(entry: entry)
    }
    .configurationDisplayName("TODOs")
    .description("See your TODOs and check them off.")
    .supportedFamilies([.systemSmall])
    .contentMarginsDisabled()
  }
}

struct MediumTodoWidget: Widget {
  let kind: String = "com.path2us.bittersweet.MediumTodoWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: kind,
      provider: TodoWidgetProvider()
    ) { entry in
      TodoWidgetView(entry: entry)
    }
    .configurationDisplayName("TODOs")
    .description("See your TODOs and check them off.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}
