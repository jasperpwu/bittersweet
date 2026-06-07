import SwiftUI
import WidgetKit

// MARK: - Timeline Entry

struct GoalWidgetEntry: TimelineEntry {
  let date: Date
  let goals: [WidgetGoalItem]
}

// MARK: - Timeline Provider

struct GoalWidgetProvider: TimelineProvider {
  typealias Entry = GoalWidgetEntry

  func placeholder(in context: Context) -> GoalWidgetEntry {
    GoalWidgetEntry(date: Date(), goals: [])
  }

  func getSnapshot(in context: Context, completion: @escaping (GoalWidgetEntry) -> Void) {
    let goals = WidgetDataManager.shared.getGoalsData()
    completion(GoalWidgetEntry(date: Date(), goals: goals))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GoalWidgetEntry>) -> Void) {
    let goals = WidgetDataManager.shared.getGoalsData()
    let entry = GoalWidgetEntry(date: Date(), goals: goals)
    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    completion(Timeline(entries: [entry], policy: .after(refreshDate)))
  }
}

// MARK: - Widget Definition

struct GoalWidget: Widget {
  let kind: String = "com.path2us.bittersweet.GoalWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: kind,
      provider: GoalWidgetProvider()
    ) { entry in
      GoalWidgetView(entry: entry)
    }
    .configurationDisplayName("Focus Goals")
    .description("Track your active focus goals.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}
