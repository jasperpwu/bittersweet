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
  unlockData: WidgetUnlockSessionData? = nil,
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
    unlockData: unlockData,
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
    let unlockData = WidgetDataManager.shared.getUnlockSessionData()
    let tag = resolveSelectedTag()
    let entry = makeEntry(
      date: Date(), session: session, unlockData: unlockData,
      tagId: tag?.id, tagName: tag?.name, tagIcon: tag?.icon, tagColor: tag?.color,
      tagDuration: tag?.lastDuration, gridItems: []
    )
    completion(entry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
    // A WidgetKit push reloads timelines rather than delivering a payload, so
    // this is where a desktop start/stop lands on a phone whose app is closed.
    // Awaited before reading session data — the entry has to reflect the session
    // the push was announcing, not the one from before it. See RemoteSessionSync.
    if #available(iOS 17.0, *) {
      Task {
        await RemoteSessionSync.refreshIfNeeded()
        completion(buildTimeline())
      }
      return
    }
    completion(buildTimeline())
  }

  private func buildTimeline() -> Timeline<HomeWidgetEntry> {
    let session = WidgetDataManager.shared.getSessionData()
    let unlockData = WidgetDataManager.shared.getUnlockSessionData()
    let tag = resolveSelectedTag()

    let currentEntry = makeEntry(
      date: Date(), session: session, unlockData: unlockData,
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
          date: endDate, session: session, unlockData: unlockData,
          tagId: tag?.id, tagName: tag?.name, tagIcon: tag?.icon, tagColor: tag?.color,
          tagDuration: tag?.lastDuration, gridItems: []
        )
        entries.append(bonusEntry)
      }
    }

    // For active unlock sessions, add an entry at endTime so widget auto-refreshes to idle
    if let unlock = unlockData, unlock.isActive, unlock.endTime > 0 {
      let unlockEndDate = Date(timeIntervalSince1970: unlock.endTime / 1000)
      if unlockEndDate > Date() {
        let unlockExpiryEntry = makeEntry(
          date: unlockEndDate, session: session, unlockData: nil,
          tagId: tag?.id, tagName: tag?.name, tagIcon: tag?.icon, tagColor: tag?.color,
          tagDuration: tag?.lastDuration, gridItems: []
        )
        entries.append(unlockExpiryEntry)
      }
    }

    let refreshDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date()
    return Timeline(entries: entries, policy: .after(refreshDate))
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
    let unlockData = WidgetDataManager.shared.getUnlockSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let gridItems = sortedGridItems(from: tags, configuration: configuration)
    return makeEntry(
      date: Date(), session: session, unlockData: unlockData,
      tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil,
      tagDuration: nil, gridItems: gridItems
    )
  }

  func timeline(for configuration: SelectGridIntent, in context: Context) async -> Timeline<HomeWidgetEntry> {
    await RemoteSessionSync.refreshIfNeeded()

    let session = WidgetDataManager.shared.getSessionData()
    let unlockData = WidgetDataManager.shared.getUnlockSessionData()
    let tags = WidgetDataManager.shared.getTagList()
    let gridItems = sortedGridItems(from: tags, configuration: configuration)

    let currentEntry = makeEntry(
      date: Date(), session: session, unlockData: unlockData,
      tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil,
      tagDuration: nil, gridItems: gridItems
    )

    var entries = [currentEntry]

    if let session = session, session.isActive, !session.isInfinite, session.endTime > 0 {
      let endDate = Date(timeIntervalSince1970: session.endTime / 1000)
      if endDate > Date() {
        let bonusEntry = makeEntry(
          date: endDate, session: session, unlockData: unlockData,
          tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil,
          tagDuration: nil, gridItems: gridItems
        )
        entries.append(bonusEntry)
      }
    }

    // For active unlock sessions, add an entry at endTime so widget auto-refreshes to idle
    if let unlock = unlockData, unlock.isActive, unlock.endTime > 0 {
      let unlockEndDate = Date(timeIntervalSince1970: unlock.endTime / 1000)
      if unlockEndDate > Date() {
        let unlockExpiryEntry = makeEntry(
          date: unlockEndDate, session: session, unlockData: nil,
          tagId: nil, tagName: nil, tagIcon: nil, tagColor: nil,
          tagDuration: nil, gridItems: gridItems
        )
        entries.append(unlockExpiryEntry)
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
    if sortOrder == .recent {
      sorted = tags.sorted { $0.lastUsedAt > $1.lastUsedAt }
    }

    return buildGridItems(from: sorted, count: count)
  }
}

// MARK: - Widget Definitions

// The pre-iOS-17 MediumWidgetStaticProvider fallback was removed with the push
// handler, not by accident: `some WidgetConfiguration` unifies its branches
// through availability erasure (SE-0360), which permits exactly ONE `#available`
// alternative — a second one fails with "return statements do not have matching
// underlying types". The iOS 17 branch was already dead code, since
// plugins/withHomeWidget.js pins this extension's deployment target to iOS 18,
// so iOS 26 vs. everything-else is the only split that can still occur.
//
// `.pushHandler` is what subscribes a widget to WidgetKit push (iOS 26+), and it
// is declared per widget rather than per extension: only widgets carrying it are
// reloaded when a push arrives. Both focus widgets get it because both render
// session state and both providers drive RemoteSessionSync — which is also why a
// remote shield change reaches this phone only if one of them is on a Home
// Screen. The configuration has to be spelled out twice: the modifier changes the
// concrete type, so it cannot be applied conditionally to a shared value.
struct SmallFocusWidget: Widget {
  let kind: String = "com.path2us.bittersweet.HomeScreenWidget"

  var body: some WidgetConfiguration {
    if #available(iOS 26.0, *) {
      return StaticConfiguration(
        kind: kind,
        provider: SmallWidgetProvider()
      ) { entry in
        HomeScreenWidgetView(entry: entry)
      }
      .configurationDisplayName("Focus Session")
      .description("Quick-start a focus session with one tap.")
      .supportedFamilies([.systemSmall])
      .pushHandler(FocusWidgetPushHandler.self)
    } else {
      return StaticConfiguration(
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
}

struct MediumFocusWidget: Widget {
  let kind: String = "com.path2us.bittersweet.MediumFocusWidget"

  var body: some WidgetConfiguration {
    if #available(iOS 26.0, *) {
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
      .contentMarginsDisabled()
      .pushHandler(FocusWidgetPushHandler.self)
    } else {
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
      .contentMarginsDisabled()
    }
  }
}
