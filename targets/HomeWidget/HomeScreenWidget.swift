import SwiftUI
import WidgetKit

// MARK: - Helper: Build grid items from tag list

private func buildGridItems(from tags: [WidgetTagInfo], count: Int) -> [WidgetTagGridItem] {
  let sliced = tags.prefix(count)
  return sliced.map { tag in
    WidgetTagGridItem(
      id: tag.id,
      name: tag.name,
      icon: tag.icon,
      color: tag.color,
      lastDuration: tag.lastDuration
    )
  }
}

// MARK: - Timeline Provider (iOS < 17, no configuration)

struct HomeWidgetProvider: TimelineProvider {
  typealias Entry = HomeWidgetEntry

  func placeholder(in context: Context) -> HomeWidgetEntry {
    HomeWidgetEntry(
      date: Date(),
      sessionData: nil,
      configuredTagId: nil,
      configuredTagName: "Focus",
      configuredTagIcon: "\u{1F3AF}",
      configuredTagColor: nil,
      configuredTagDuration: nil,
      configuredTags: []
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
      configuredTagIcon: firstTag?.icon ?? "\u{1F3AF}",
      configuredTagColor: firstTag?.color,
      configuredTagDuration: firstTag?.lastDuration,
      configuredTags: buildGridItems(from: tags, count: 4)
    )
    completion(entry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
    let session = WidgetDataManager.shared.getSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let firstTag = tags.first
    let gridItems = buildGridItems(from: tags, count: 4)

    let currentEntry = HomeWidgetEntry(
      date: Date(),
      sessionData: session,
      configuredTagId: firstTag?.id,
      configuredTagName: firstTag?.name ?? "Focus",
      configuredTagIcon: firstTag?.icon ?? "\u{1F3AF}",
      configuredTagColor: firstTag?.color,
      configuredTagDuration: firstTag?.lastDuration,
      configuredTags: gridItems
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
          configuredTagIcon: firstTag?.icon ?? "\u{1F3AF}",
          configuredTagColor: firstTag?.color,
          configuredTagDuration: firstTag?.lastDuration,
          configuredTags: gridItems
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
      configuredTagIcon: "\u{1F3AF}",
      configuredTagColor: nil,
      configuredTagDuration: nil,
      configuredTags: []
    )
  }

  func snapshot(for configuration: SelectTagIntent, in context: Context) async -> HomeWidgetEntry {
    let session = WidgetDataManager.shared.getSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let gridItems = sortedGridItems(from: tags, configuration: configuration)

    let tagDuration: Int? = {
      guard let tagId = configuration.tag?.id else { return nil }
      return tags.first(where: { $0.id == tagId })?.lastDuration
    }()

    return HomeWidgetEntry(
      date: Date(),
      sessionData: session,
      configuredTagId: configuration.tag?.id,
      configuredTagName: configuration.tag?.name ?? "Focus",
      configuredTagIcon: configuration.tag?.icon ?? "\u{1F3AF}",
      configuredTagColor: configuration.tag?.color,
      configuredTagDuration: tagDuration,
      configuredTags: gridItems
    )
  }

  func timeline(for configuration: SelectTagIntent, in context: Context) async -> Timeline<HomeWidgetEntry> {
    let session = WidgetDataManager.shared.getSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let gridItems = sortedGridItems(from: tags, configuration: configuration)

    let tagId = configuration.tag?.id
    let tagName = configuration.tag?.name ?? "Focus"
    let tagIcon = configuration.tag?.icon ?? "\u{1F3AF}"
    let tagColor = configuration.tag?.color
    let tagDuration: Int? = {
      guard let id = tagId else { return nil }
      return tags.first(where: { $0.id == id })?.lastDuration
    }()

    let currentEntry = HomeWidgetEntry(
      date: Date(),
      sessionData: session,
      configuredTagId: tagId,
      configuredTagName: tagName,
      configuredTagIcon: tagIcon,
      configuredTagColor: tagColor,
      configuredTagDuration: tagDuration,
      configuredTags: gridItems
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
          configuredTagDuration: tagDuration,
          configuredTags: gridItems
        )
        entries.append(endEntry)
      }
    }

    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    return Timeline(entries: entries, policy: .after(refreshDate))
  }

  // MARK: - Sort + Slice

  private func sortedGridItems(from tags: [WidgetTagInfo], configuration: SelectTagIntent) -> [WidgetTagGridItem] {
    let sortOrder = configuration.sortOrder ?? .currentOrder
    let gridSize = configuration.gridSize ?? .four
    let count = gridSize == .two ? 2 : 4

    var sorted = tags
    if sortOrder == .mostUsed {
      sorted = tags.sorted { $0.usageCount > $1.usageCount }
    }
    // .currentOrder keeps the original order from JS

    return buildGridItems(from: sorted, count: count)
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
