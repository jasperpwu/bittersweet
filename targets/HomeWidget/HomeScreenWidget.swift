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

// MARK: - Helper: Build a HomeWidgetEntry from tag list + session

private func makeEntry(
  date: Date,
  session: WidgetSessionData?,
  tagId: String?,
  tagName: String?,
  tagIcon: String?,
  tagColor: String?,
  tagDuration: Int?,
  gridItems: [WidgetTagGridItem]
) -> HomeWidgetEntry {
  HomeWidgetEntry(
    date: date,
    sessionData: session,
    configuredTagId: tagId,
    configuredTagName: tagName ?? "Focus",
    configuredTagIcon: tagIcon ?? "\u{1F3AF}",
    configuredTagColor: tagColor,
    configuredTagDuration: tagDuration,
    configuredTags: gridItems
  )
}

// MARK: - Timeline Provider (iOS < 17, no configuration — used by both sizes)

struct SmallWidgetProvider: TimelineProvider {
  typealias Entry = HomeWidgetEntry

  /// Resolve the selected tag from UserDefaults, falling back to first tag
  private func resolveSelectedTag() -> WidgetTagInfo? {
    let tags = WidgetDataManager.shared.getTagList()
    if let selectedId = WidgetDataManager.shared.getSelectedTagId(),
       let tag = tags.first(where: { $0.id == selectedId }) {
      return tag
    }
    return tags.first
  }

  func placeholder(in context: Context) -> HomeWidgetEntry {
    makeEntry(date: Date(), session: nil, tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil, tagDuration: nil, gridItems: [])
  }

  func getSnapshot(in context: Context, completion: @escaping (HomeWidgetEntry) -> Void) {
    let session = WidgetDataManager.shared.getSessionData()
    let tag = resolveSelectedTag()
    let entry = makeEntry(
      date: Date(), session: session,
      tagId: tag?.id, tagName: tag?.name, tagIcon: tag?.icon, tagColor: tag?.color,
      tagDuration: tag?.lastDuration, gridItems: []
    )
    completion(entry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
    let session = WidgetDataManager.shared.getSessionData()
    let tag = resolveSelectedTag()

    let currentEntry = makeEntry(
      date: Date(), session: session,
      tagId: tag?.id, tagName: tag?.name, tagIcon: tag?.icon, tagColor: tag?.color,
      tagDuration: tag?.lastDuration, gridItems: []
    )

    var entries = [currentEntry]

    // For timed sessions, add a second entry at endDate that still carries the
    // active session. Text(date, style: .timer) will automatically count UP once
    // endTime is in the past, giving us bonus-time behavior. The widget only
    // returns to idle when reloadTimelines() is called on session stop.
    if let session = session, session.isActive, !session.isInfinite, session.endTime > 0 {
      let endDate = Date(timeIntervalSince1970: session.endTime / 1000)
      if endDate > Date() {
        let bonusEntry = makeEntry(
          date: endDate, session: session,
          tagId: tag?.id, tagName: tag?.name, tagIcon: tag?.icon, tagColor: tag?.color,
          tagDuration: tag?.lastDuration, gridItems: []
        )
        entries.append(bonusEntry)
      }
    }

    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    completion(Timeline(entries: entries, policy: .after(refreshDate)))
  }
}

// MARK: - Medium Widget Static Provider (iOS < 17 fallback, no configuration)

struct MediumWidgetStaticProvider: TimelineProvider {
  typealias Entry = HomeWidgetEntry

  func placeholder(in context: Context) -> HomeWidgetEntry {
    makeEntry(date: Date(), session: nil, tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil, tagDuration: nil, gridItems: [])
  }

  func getSnapshot(in context: Context, completion: @escaping (HomeWidgetEntry) -> Void) {
    let session = WidgetDataManager.shared.getSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let entry = makeEntry(
      date: Date(), session: session,
      tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil,
      tagDuration: nil, gridItems: buildGridItems(from: tags, count: 4)
    )
    completion(entry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
    let session = WidgetDataManager.shared.getSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let gridItems = buildGridItems(from: tags, count: 4)

    let currentEntry = makeEntry(
      date: Date(), session: session,
      tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil,
      tagDuration: nil, gridItems: gridItems
    )

    var entries = [currentEntry]

    if let session = session, session.isActive, !session.isInfinite, session.endTime > 0 {
      let endDate = Date(timeIntervalSince1970: session.endTime / 1000)
      if endDate > Date() {
        let bonusEntry = makeEntry(
          date: endDate, session: session,
          tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil,
          tagDuration: nil, gridItems: gridItems
        )
        entries.append(bonusEntry)
      }
    }

    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    completion(Timeline(entries: entries, policy: .after(refreshDate)))
  }
}

// MARK: - iOS 17+ Medium Widget Provider (SelectGridIntent — sort & grid size)

@available(iOS 17.0, *)
struct MediumWidgetProvider: AppIntentTimelineProvider {
  typealias Entry = HomeWidgetEntry
  typealias Intent = SelectGridIntent

  func placeholder(in context: Context) -> HomeWidgetEntry {
    makeEntry(date: Date(), session: nil, tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil, tagDuration: nil, gridItems: [])
  }

  func snapshot(for configuration: SelectGridIntent, in context: Context) async -> HomeWidgetEntry {
    let session = WidgetDataManager.shared.getSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let gridItems = sortedGridItems(from: tags, configuration: configuration)
    return makeEntry(
      date: Date(), session: session,
      tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil,
      tagDuration: nil, gridItems: gridItems
    )
  }

  func timeline(for configuration: SelectGridIntent, in context: Context) async -> Timeline<HomeWidgetEntry> {
    let session = WidgetDataManager.shared.getSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let gridItems = sortedGridItems(from: tags, configuration: configuration)

    let currentEntry = makeEntry(
      date: Date(), session: session,
      tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil,
      tagDuration: nil, gridItems: gridItems
    )

    var entries = [currentEntry]

    if let session = session, session.isActive, !session.isInfinite, session.endTime > 0 {
      let endDate = Date(timeIntervalSince1970: session.endTime / 1000)
      if endDate > Date() {
        let bonusEntry = makeEntry(
          date: endDate, session: session,
          tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil,
          tagDuration: nil, gridItems: gridItems
        )
        entries.append(bonusEntry)
      }
    }

    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    return Timeline(entries: entries, policy: .after(refreshDate))
  }

  private func sortedGridItems(from tags: [WidgetTagInfo], configuration: SelectGridIntent) -> [WidgetTagGridItem] {
    let sortOrder = configuration.sortOrder ?? .currentOrder
    let gridSize = configuration.gridSize ?? .four
    let count = gridSize == .two ? 2 : 4

    var sorted = tags
    if sortOrder == .mostUsed {
      sorted = tags.sorted { $0.usageCount > $1.usageCount }
    }

    return buildGridItems(from: sorted, count: count)
  }
}

// MARK: - Widget Definitions

struct SmallFocusWidget: Widget {
  let kind: String = "com.path2us.bittersweet.HomeScreenWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: kind,
      provider: SmallWidgetProvider()
    ) { entry in
      HomeScreenWidgetView(entry: entry)
    }
    .configurationDisplayName("Focus Session")
    .description("Quick-start a focus session with one tap.")
    .supportedFamilies([.systemSmall])
  }
}

struct MediumFocusWidget: Widget {
  let kind: String = "com.path2us.bittersweet.MediumFocusWidget"

  var body: some WidgetConfiguration {
    if #available(iOS 17.0, *) {
      return AppIntentConfiguration(
        kind: kind,
        intent: SelectGridIntent.self,
        provider: MediumWidgetProvider()
      ) { entry in
        HomeScreenWidgetView(entry: entry)
      }
      .configurationDisplayName("Focus Grid")
      .description("Start any focus session from a tag grid.")
      .supportedFamilies([.systemMedium])
    } else {
      return StaticConfiguration(
        kind: kind,
        provider: MediumWidgetStaticProvider()
      ) { entry in
        HomeScreenWidgetView(entry: entry)
      }
      .configurationDisplayName("Focus Grid")
      .description("Start any focus session from a tag grid.")
      .supportedFamilies([.systemMedium])
    }
  }
}
