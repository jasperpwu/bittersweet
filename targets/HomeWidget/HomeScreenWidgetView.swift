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
        .widgetBackground(Color(hex: "#F5E6D3"))
    } else {
      idleView
        .widgetBackground(Color(hex: "#F5E6D3"))
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
        Text(session.tagIcon)
          .font(.system(size: 20))
        Text(session.tagName)
          .font(.system(size: 20, weight: .bold))
          .foregroundStyle(tagColor)
          .lineLimit(1)
      }

      Spacer().frame(height: 6)

      // Live timer
      if session.isInfinite {
        Text(Date(timeIntervalSince1970: session.startTime / 1000), style: .timer)
          .font(.system(size: 28, weight: .semibold))
          .foregroundStyle(Color(hex: "#5D4E37"))
          .minimumScaleFactor(0.7)
      } else if isBonusTime(session) {
        HStack(spacing: 4) {
          Text("+")
          Text(Date(timeIntervalSince1970: session.endTime / 1000), style: .timer)
        }
        .font(.system(size: 28, weight: .semibold))
        .foregroundStyle(Color(hex: "#4CAF7C"))
        .minimumScaleFactor(0.7)
      } else {
        Text(timerInterval: Date(timeIntervalSince1970: session.startTime / 1000)...Date(timeIntervalSince1970: session.endTime / 1000), countsDown: true, showsHours: false)
          .font(.system(size: 28, weight: .semibold))
          .foregroundStyle(Color(hex: "#5D4E37"))
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
          Text(session.tagIcon)
            .font(.title3)
          Text(session.tagName)
            .font(.headline)
            .fontWeight(.semibold)
            .foregroundStyle(Color(hex: "#5D4E37"))
        }

        // Live timer
        if session.isInfinite {
          // Count up from start time
          Text(Date(timeIntervalSince1970: session.startTime / 1000), style: .timer)
            .font(.system(size: 32, weight: .bold, design: .monospaced))
            .foregroundStyle(Color(hex: "#8B4513"))
            .minimumScaleFactor(0.7)
        } else if isBonusTime(session) {
          // Bonus time — count up from end time in green
          HStack(spacing: 4) {
            Text("+")
            Text(Date(timeIntervalSince1970: session.endTime / 1000), style: .timer)
          }
          .font(.system(size: 32, weight: .bold, design: .monospaced))
          .foregroundStyle(Color(hex: "#4CAF7C"))
          .minimumScaleFactor(0.7)
        } else {
          // Count down to end time
          Text(timerInterval: Date(timeIntervalSince1970: session.startTime / 1000)...Date(timeIntervalSince1970: session.endTime / 1000), countsDown: true, showsHours: false)
            .font(.system(size: 32, weight: .bold, design: .monospaced))
            .foregroundStyle(Color(hex: "#8B4513"))
            .minimumScaleFactor(0.7)
        }

        Text(isBonusTime(session) ? "Bonus Time" : "Focusing...")
          .font(.caption)
          .foregroundStyle(Color(hex: "#8B7355"))
      }

      Spacer()

      // Stop button — runs StopSessionIntent directly (no app open)
      if #available(iOS 17.0, *) {
        Button(intent: StopSessionIntent()) {
          VStack(spacing: 4) {
            Image(systemName: "stop.fill")
              .font(.title2)
            Text("Stop")
              .font(.caption2)
              .fontWeight(.medium)
          }
          .foregroundStyle(.white)
          .frame(width: 56, height: 56)
          .background(tagColor, in: RoundedRectangle(cornerRadius: 14))
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
        Text(entry.configuredTagIcon ?? "🎯")
          .font(.system(size: 20))
        Text(entry.configuredTagName ?? "Focus")
          .font(.system(size: 20, weight: .bold))
          .foregroundStyle(tagColor)
          .lineLimit(1)
      }

      Spacer().frame(height: 6)

      // Duration
      Text(durationLabel.isEmpty ? "∞" : durationLabel)
        .font(.system(size: 28, weight: .semibold))
        .foregroundStyle(Color(hex: "#5D4E37"))

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
          .foregroundStyle(Color(hex: "#5D4E37"))

        Text("Open the app to get started")
          .font(.subheadline)
          .foregroundStyle(Color(hex: "#8B7355"))
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
            Text(tag.name)
              .font(.system(size: 18, weight: .bold))
              .foregroundStyle(.white)
              .lineLimit(1)
            if !durationText.isEmpty {
              Text(durationText)
                .font(.system(size: 22, weight: .semibold))
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
