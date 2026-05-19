import SwiftUI
import WidgetKit

// MARK: - Timeline Provider

struct HomeWidgetProvider: TimelineProvider {
  typealias Entry = HomeWidgetEntry

  func placeholder(in context: Context) -> HomeWidgetEntry {
    HomeWidgetEntry(
      date: Date(),
      sessionData: nil,
      configuredTagId: nil,
      configuredTagName: "Focus",
      configuredTagIcon: "🎯",
      configuredTagColor: nil,
      configuredTagDuration: nil
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (HomeWidgetEntry) -> Void) {
    let session = WidgetDataManager.shared.getSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let firstTag = tags.first

    let entry = HomeWidgetEntry(
      date: Date(),
      sessionData: session,
      configuredTagId: firstTag?.id,
      configuredTagName: firstTag?.name ?? "Focus",
      configuredTagIcon: firstTag?.icon ?? "🎯",
      configuredTagColor: firstTag?.color,
      configuredTagDuration: firstTag?.lastDuration
    )
    completion(entry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
    let session = WidgetDataManager.shared.getSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let firstTag = tags.first

    let currentEntry = HomeWidgetEntry(
      date: Date(),
      sessionData: session,
      configuredTagId: firstTag?.id,
      configuredTagName: firstTag?.name ?? "Focus",
      configuredTagIcon: firstTag?.icon ?? "🎯",
      configuredTagColor: firstTag?.color,
      configuredTagDuration: firstTag?.lastDuration
    )

    var entries: [HomeWidgetEntry] = [currentEntry]

    // If there's an active session with an end time, add a transition entry
    if let session = session, session.isActive, !session.isInfinite, session.endTime > 0 {
      let endDate = Date(timeIntervalSince1970: session.endTime / 1000)
      if endDate > Date() {
        let endEntry = HomeWidgetEntry(
          date: endDate,
          sessionData: nil, // Session will be over
          configuredTagId: firstTag?.id,
          configuredTagName: firstTag?.name ?? "Focus",
          configuredTagIcon: firstTag?.icon ?? "🎯",
          configuredTagColor: firstTag?.color,
          configuredTagDuration: firstTag?.lastDuration
        )
        entries.append(endEntry)
      }
    }

    // Refresh every 15 minutes if idle, or at session end if active
    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    let timeline = Timeline(entries: entries, policy: .after(refreshDate))
    completion(timeline)
  }
}

// MARK: - iOS 17+ Configurable Provider

@available(iOS 17.0, *)
struct HomeWidgetAppIntentProvider: AppIntentTimelineProvider {
  typealias Entry = HomeWidgetEntry
  typealias Intent = SelectTagIntent

  func placeholder(in context: Context) -> HomeWidgetEntry {
    HomeWidgetEntry(
      date: Date(),
      sessionData: nil,
      configuredTagId: nil,
      configuredTagName: "Focus",
      configuredTagIcon: "🎯",
      configuredTagColor: nil,
      configuredTagDuration: nil
    )
  }

  func snapshot(for configuration: SelectTagIntent, in context: Context) async -> HomeWidgetEntry {
    let session = WidgetDataManager.shared.getSessionData()
    let tagDuration: Int? = {
      guard let tagId = configuration.tag?.id else { return nil }
      let tags = WidgetDataManager.shared.getTagList()
      return tags.first(where: { $0.id == tagId })?.lastDuration
    }()
    return HomeWidgetEntry(
      date: Date(),
      sessionData: session,
      configuredTagId: configuration.tag?.id,
      configuredTagName: configuration.tag?.name ?? "Focus",
      configuredTagIcon: configuration.tag?.icon ?? "🎯",
      configuredTagColor: configuration.tag?.color,
      configuredTagDuration: tagDuration
    )
  }

  func timeline(for configuration: SelectTagIntent, in context: Context) async -> Timeline<HomeWidgetEntry> {
    let session = WidgetDataManager.shared.getSessionData()

    let tagId = configuration.tag?.id
    let tagName = configuration.tag?.name ?? "Focus"
    let tagIcon = configuration.tag?.icon ?? "🎯"
    let tagColor = configuration.tag?.color
    let tagDuration: Int? = {
      guard let id = tagId else { return nil }
      let tags = WidgetDataManager.shared.getTagList()
      return tags.first(where: { $0.id == id })?.lastDuration
    }()

    let currentEntry = HomeWidgetEntry(
      date: Date(),
      sessionData: session,
      configuredTagId: tagId,
      configuredTagName: tagName,
      configuredTagIcon: tagIcon,
      configuredTagColor: tagColor,
      configuredTagDuration: tagDuration
    )

    var entries: [HomeWidgetEntry] = [currentEntry]

    if let session = session, session.isActive, !session.isInfinite, session.endTime > 0 {
      let endDate = Date(timeIntervalSince1970: session.endTime / 1000)
      if endDate > Date() {
        let endEntry = HomeWidgetEntry(
          date: endDate,
          sessionData: nil,
          configuredTagId: tagId,
          configuredTagName: tagName,
          configuredTagIcon: tagIcon,
          configuredTagColor: tagColor,
          configuredTagDuration: tagDuration
        )
        entries.append(endEntry)
      }
    }

    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    return Timeline(entries: entries, policy: .after(refreshDate))
  }
}

// MARK: - Widget Definition

struct HomeScreenWidget: Widget {
  let kind: String = "com.path2us.bittersweet.HomeScreenWidget"

  var body: some WidgetConfiguration {
    if #available(iOS 17.0, *) {
      return AppIntentConfiguration(
        kind: kind,
        intent: SelectTagIntent.self,
        provider: HomeWidgetAppIntentProvider()
      ) { entry in
        HomeScreenWidgetView(entry: entry)
      }
      .configurationDisplayName("Focus Session")
      .description("Start and stop focus sessions from your home screen.")
      .supportedFamilies([.systemSmall, .systemMedium])
    } else {
      return StaticConfiguration(
        kind: kind,
        provider: HomeWidgetProvider()
      ) { entry in
        HomeScreenWidgetView(entry: entry)
      }
      .configurationDisplayName("Focus Session")
      .description("Start and stop focus sessions from your home screen.")
      .supportedFamilies([.systemSmall, .systemMedium])
    }
  }
}
