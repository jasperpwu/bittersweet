import SwiftUI
import WidgetKit

// MARK: - Grid Item for Medium Widget

struct WidgetTagGridItem {
  let id: String
  let name: String
  let icon: String
  let color: String
  let lastDuration: Int? // minutes; nil = unknown, 0 = infinite
}

// MARK: - Timeline Entry

struct HomeWidgetEntry: TimelineEntry {
  let date: Date
  let sessionData: WidgetSessionData?
  let unlockData: WidgetUnlockSessionData?
  let configuredTagId: String?
  let configuredTagName: String?
  let configuredTagIcon: String?
  let configuredTagColor: String?
  let configuredTagDuration: Int? // minutes; nil = unknown, 0 = infinite
  let configuredTags: [WidgetTagGridItem] // for medium widget grid
}

// MARK: - Widget View

struct HomeScreenWidgetView: View {
  let entry: HomeWidgetEntry

  @Environment(\.widgetFamily) var family
  @Environment(\.colorScheme) var colorScheme

  // MARK: - Adaptive Colors

  private var widgetBg: Color {
    colorScheme == .dark ? Color(hex: "#1B1C30") : Color(hex: "#F5E6D3")
  }
  private var primaryText: Color {
    colorScheme == .dark ? .white : Color(hex: "#5D4E37")
  }
  private var secondaryText: Color {
    colorScheme == .dark ? Color(hex: "#CACACA") : Color(hex: "#6B5A42")
  }

  /// Resolve tag color: active session color takes priority, then configured tag color, then fallback
  private var tagColor: Color {
    if let session = entry.sessionData, session.isActive, !session.tagColor.isEmpty {
      return Color(hex: session.tagColor)
    }
    if let color = entry.configuredTagColor, !color.isEmpty {
      return Color(hex: color)
    }
    return Color(hex: "#5D4E37")
  }

  private var durationLabel: String {
    guard let duration = entry.configuredTagDuration else { return "" }
    if duration == 0 { return "∞" }
    return "\(duration) min"
  }

  var body: some View {
    if let session = entry.sessionData, session.isActive {
      activeSessionView(session: session)
        .widgetBackground(widgetBg)
    } else if let unlock = entry.unlockData, unlock.isActive {
      unlockSessionView(unlock: unlock)
        .widgetBackground(widgetBg)
    } else {
      idleView
        .widgetBackground(widgetBg)
    }
  }

  // MARK: - Active State

  private func activeSessionView(session: WidgetSessionData) -> some View {
    Group {
      if family == .systemSmall {
        smallActiveView(session: session)
      } else {
        mediumActiveView(session: session)
      }
    }
  }

  /// Whether a timed session's end time has passed (bonus / count-up mode).
  /// Uses the timeline entry date (not Date()) so the bonus entry rendered at
  /// timeline-creation time still gets the correct color when displayed later.
  private func isBonusTime(_ session: WidgetSessionData) -> Bool {
    !session.isInfinite && session.endTime > 0
      && Date(timeIntervalSince1970: session.endTime / 1000) <= entry.date
  }

  private func smallActiveView(session: WidgetSessionData) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      // Tag icon + name
      HStack(spacing: 6) {
        Text(session.tagIcon.isEmpty ? "🎯" : session.tagIcon)
          .font(.system(size: 15))
        Text(session.tagName.isEmpty ? "Focus" : session.tagName)
          .font(.system(size: 15, weight: .bold))
          .foregroundStyle(tagColor)
          .lineLimit(1)
      }

      Spacer().frame(height: 6)

      // Live timer
      if session.isInfinite {
        Text(Date(timeIntervalSince1970: session.startTime / 1000), style: .timer)
          .font(.system(size: 36, weight: .semibold))
          .foregroundStyle(primaryText)
          .minimumScaleFactor(0.7)
      } else if isBonusTime(session) {
        HStack(spacing: 4) {
          Text("+")
          Text(Date(timeIntervalSince1970: session.endTime / 1000), style: .timer)
        }
        .font(.system(size: 36, weight: .semibold))
        .foregroundStyle(Color(hex: "#4CAF7C"))
        .minimumScaleFactor(0.7)
      } else {
        Text(timerInterval: Date(timeIntervalSince1970: session.startTime / 1000)...Date(timeIntervalSince1970: session.endTime / 1000), countsDown: true, showsHours: false)
          .font(.system(size: 36, weight: .semibold))
          .foregroundStyle(primaryText)
          .minimumScaleFactor(0.7)
      }

      Spacer()

      // Stop button
      if #available(iOS 17.0, *) {
        Button(intent: StopSessionIntent()) {
          Text("Stop")
            .font(.subheadline)
            .fontWeight(.semibold)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 36)
            .background(tagColor, in: Capsule())
        }
        .buttonStyle(.plain)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private func mediumActiveView(session: WidgetSessionData) -> some View {
    HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 6) {
        HStack(spacing: 6) {
          Text(session.tagIcon.isEmpty ? "🎯" : session.tagIcon)
            .font(.system(size: 15))
          Text(session.tagName.isEmpty ? "Focus" : session.tagName)
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(tagColor)
            .lineLimit(1)
        }

        // Live timer
        if session.isInfinite {
          // Count up from start time
          Text(Date(timeIntervalSince1970: session.startTime / 1000), style: .timer)
            .font(.system(size: 42, weight: .bold, design: .monospaced))
            .foregroundStyle(primaryText)
            .minimumScaleFactor(0.7)
        } else if isBonusTime(session) {
          // Bonus time — count up from end time in green
          HStack(spacing: 4) {
            Text("+")
            Text(Date(timeIntervalSince1970: session.endTime / 1000), style: .timer)
          }
          .font(.system(size: 42, weight: .bold, design: .monospaced))
          .foregroundStyle(Color(hex: "#4CAF7C"))
          .minimumScaleFactor(0.7)
        } else {
          // Count down to end time
          Text(timerInterval: Date(timeIntervalSince1970: session.startTime / 1000)...Date(timeIntervalSince1970: session.endTime / 1000), countsDown: true, showsHours: false)
            .font(.system(size: 42, weight: .bold, design: .monospaced))
            .foregroundStyle(primaryText)
            .minimumScaleFactor(0.7)
        }

        Text(isBonusTime(session) ? "Bonus Time" : "Focusing...")
          .font(.caption)
          .foregroundStyle(secondaryText)
      }

      Spacer()

      // Stop button — runs StopSessionIntent directly (no app open)
      if #available(iOS 17.0, *) {
        Button(intent: StopSessionIntent()) {
          Image(systemName: "stop.fill")
            .font(.title2)
          .foregroundStyle(.white)
          .frame(width: 56, height: 56)
          .background(tagColor, in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
      }
    }
    .padding(16)
  }

  // MARK: - Unlock State

  private func unlockSessionView(unlock: WidgetUnlockSessionData) -> some View {
    Group {
      if family == .systemSmall {
        smallUnlockView(unlock: unlock)
      } else {
        mediumUnlockView(unlock: unlock)
      }
    }
  }

  private func smallUnlockView(unlock: WidgetUnlockSessionData) -> some View {
    let endDate = Date(timeIntervalSince1970: unlock.endTime / 1000)
    return VStack(alignment: .leading, spacing: 0) {
      // Header
      HStack(spacing: 6) {
        Text("\u{1F513}")
          .font(.system(size: 15))
        Text("Unlocked")
          .font(.system(size: 15, weight: .bold))
          .foregroundStyle(Color(hex: "#4CAF7C"))
          .lineLimit(1)
      }

      Spacer().frame(height: 6)

      // Countdown timer
      Text(timerInterval: Date()...endDate, countsDown: true, showsHours: false)
        .font(.system(size: 36, weight: .semibold))
        .foregroundStyle(primaryText)
        .minimumScaleFactor(0.7)

      Spacer()

      // Stop button
      if #available(iOS 17.0, *) {
        Button(intent: StopUnlockIntent()) {
          Text("Stop")
            .font(.subheadline)
            .fontWeight(.semibold)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 36)
            .background(Color(hex: "#B22222"), in: Capsule())
        }
        .buttonStyle(.plain)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private func mediumUnlockView(unlock: WidgetUnlockSessionData) -> some View {
    let endDate = Date(timeIntervalSince1970: unlock.endTime / 1000)
    return HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 6) {
        HStack(spacing: 6) {
          Text("\u{1F513}")
            .font(.system(size: 15))
          Text("Unlocked")
            .font(.system(size: 15, weight: .bold))
            .foregroundStyle(Color(hex: "#4CAF7C"))
            .lineLimit(1)
        }

        // Countdown timer
        Text(timerInterval: Date()...endDate, countsDown: true, showsHours: false)
          .font(.system(size: 42, weight: .bold, design: .monospaced))
          .foregroundStyle(primaryText)
          .minimumScaleFactor(0.7)

        Text("Apps unlocked")
          .font(.caption)
          .foregroundStyle(secondaryText)
      }

      Spacer()

      // Stop button
      if #available(iOS 17.0, *) {
        Button(intent: StopUnlockIntent()) {
          Image(systemName: "stop.fill")
            .font(.title2)
            .foregroundStyle(.white)
            .frame(width: 56, height: 56)
            .background(Color(hex: "#B22222"), in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
      }
    }
    .padding(16)
  }

  // MARK: - Idle State

  private var idleView: some View {
    Group {
      if family == .systemSmall {
        smallIdleView
      } else {
        mediumIdleView
      }
    }
  }

  private var smallIdleView: some View {
    VStack(alignment: .leading, spacing: 0) {
      // Tag icon + name
      HStack(spacing: 6) {
        let icon = entry.configuredTagIcon ?? ""
        Text(icon.isEmpty ? "🎯" : icon)
          .font(.system(size: 15))
        let name = entry.configuredTagName ?? ""
        Text(name.isEmpty ? "Focus" : name)
          .font(.system(size: 15, weight: .bold))
          .foregroundStyle(tagColor)
          .lineLimit(1)
      }

      Spacer().frame(height: 6)

      // Duration
      Text(durationLabel.isEmpty ? "∞" : durationLabel)
        .font(.system(size: 36, weight: .semibold))
        .foregroundStyle(primaryText)

      Spacer()

      // Start button
      if #available(iOS 17.0, *) {
        Button(intent: StartSessionIntent(tagId: entry.configuredTagId, duration: entry.configuredTagDuration)) {
          Text("Start")
            .font(.subheadline)
            .fontWeight(.semibold)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 36)
            .background(tagColor, in: Capsule())
        }
        .buttonStyle(.plain)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var mediumIdleView: some View {
    Group {
      if entry.configuredTags.isEmpty {
        // Fallback: no tags available
        mediumIdleFallbackView
      } else if #available(iOS 17.0, *) {
        mediumIdleGridView
      } else {
        mediumIdleFallbackView
      }
    }
  }

  private var mediumIdleFallbackView: some View {
    HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 8) {
        Text("Ready to Focus")
          .font(.headline)
          .fontWeight(.semibold)
          .foregroundStyle(primaryText)

        Text("Open the app to get started")
          .font(.subheadline)
          .foregroundStyle(secondaryText)
      }
      Spacer()
    }
    .padding(16)
  }

  @available(iOS 17.0, *)
  private var mediumIdleGridView: some View {
    let tags = entry.configuredTags
    let isTwoTag = tags.count <= 2
    return VStack(spacing: 0) {
      if isTwoTag {
        // 1 row x 2 columns
        HStack(spacing: 10) {
          ForEach(0..<min(tags.count, 2), id: \.self) { i in
            tagGridButton(tag: tags[i])
          }
        }
      } else {
        // 2 rows x 2 columns
        VStack(spacing: 10) {
          HStack(spacing: 10) {
            tagGridButton(tag: tags[0])
            if tags.count > 1 {
              tagGridButton(tag: tags[1])
            }
          }
          HStack(spacing: 10) {
            if tags.count > 2 {
              tagGridButton(tag: tags[2])
            }
            if tags.count > 3 {
              tagGridButton(tag: tags[3])
            }
          }
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(14)
  }

  @available(iOS 17.0, *)
  private func tagGridButton(tag: WidgetTagGridItem) -> some View {
    let buttonColor = Color(hex: tag.color.isEmpty ? "#5D4E37" : tag.color)
    let durationText: String = {
      guard let d = tag.lastDuration else { return "" }
      return d == 0 ? "\u{221E}" : "\(d)m"
    }()
    return Button(intent: StartSessionIntent(tagId: tag.id, duration: tag.lastDuration)) {
      ZStack {
        RoundedRectangle(cornerRadius: 14)
          .fill(buttonColor)
        HStack(spacing: 0) {
          VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 4) {
              Text(tag.icon.isEmpty ? "🎯" : tag.icon)
                .font(.system(size: 13))
              Text(tag.name)
                .font(.system(size: 13, weight: .bold))
                .lineLimit(1)
            }
            .foregroundStyle(.white)
            if !durationText.isEmpty {
              Text(durationText)
                .font(.system(size: 29, weight: .semibold))
                .foregroundStyle(.white.opacity(0.75))
            }
          }
          Spacer()
          Image(systemName: "play.fill")
            .font(.system(size: 16))
            .foregroundStyle(.white.opacity(0.7))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
      }
    }
    .buttonStyle(.plain)
  }
}

// MARK: - Widget Background Modifier (iOS 17 containerBackground support)

extension View {
  @ViewBuilder
  func widgetBackground(_ color: Color) -> some View {
    if #available(iOS 17.0, *) {
      self.containerBackground(for: .widget) { color }
    } else {
      self.background(color)
    }
  }
}

// Note: Color(hex:) extension is provided by Color+hex.swift in the same target
