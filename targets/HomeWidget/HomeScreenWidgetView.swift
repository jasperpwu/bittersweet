import SwiftUI
import WidgetKit

// MARK: - Timeline Entry

struct HomeWidgetEntry: TimelineEntry {
  let date: Date
  let sessionData: WidgetSessionData?
  let configuredTagId: String?
  let configuredTagName: String?
  let configuredTagIcon: String?
  let configuredTagColor: String?
  let configuredTagDuration: Int? // minutes; nil = unknown, 0 = infinite
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

  private func smallActiveView(session: WidgetSessionData) -> some View {
    VStack(spacing: 0) {
      Spacer()

      // Tag icon + name
      HStack(spacing: 6) {
        Text(session.tagIcon)
          .font(.system(size: 24))
        Text(session.tagName)
          .font(.system(size: 20, weight: .bold))
          .foregroundStyle(tagColor)
          .lineLimit(1)
      }

      Spacer().frame(height: 10)

      // Live timer
      if session.isInfinite {
        Text(Date(timeIntervalSince1970: session.startTime / 1000), style: .timer)
          .font(.system(size: 36, weight: .semibold))
          .foregroundStyle(Color(hex: "#5D4E37"))
          .multilineTextAlignment(.center)
          .minimumScaleFactor(0.7)
          .frame(maxWidth: .infinity, alignment: .center)
      } else {
        Text(Date(timeIntervalSince1970: session.endTime / 1000), style: .timer)
          .font(.system(size: 36, weight: .semibold))
          .foregroundStyle(Color(hex: "#5D4E37"))
          .multilineTextAlignment(.center)
          .minimumScaleFactor(0.7)
          .frame(maxWidth: .infinity, alignment: .center)
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
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
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
        } else {
          // Count down to end time
          Text(Date(timeIntervalSince1970: session.endTime / 1000), style: .timer)
            .font(.system(size: 32, weight: .bold, design: .monospaced))
            .foregroundStyle(Color(hex: "#8B4513"))
            .minimumScaleFactor(0.7)
        }

        Text("Focusing...")
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
    VStack(spacing: 0) {
      Spacer()

      // Tag icon + name
      HStack(spacing: 6) {
        Text(entry.configuredTagIcon ?? "🎯")
          .font(.system(size: 24))
        Text(entry.configuredTagName ?? "Focus")
          .font(.system(size: 20, weight: .bold))
          .foregroundStyle(tagColor)
          .lineLimit(1)
      }

      Spacer().frame(height: 10)

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
    .padding(.horizontal, 16)
    .padding(.vertical, 14)
  }

  private var mediumIdleView: some View {
    HStack(spacing: 12) {
      VStack(alignment: .leading, spacing: 8) {
        Text("Ready to Focus")
          .font(.headline)
          .fontWeight(.semibold)
          .foregroundStyle(Color(hex: "#5D4E37"))

        if let tagIcon = entry.configuredTagIcon,
           let tagName = entry.configuredTagName {
          HStack(spacing: 4) {
            Text(tagIcon)
              .font(.subheadline)
            Text(tagName)
              .font(.subheadline)
              .foregroundStyle(Color(hex: "#8B7355"))
            Text("·")
              .font(.subheadline)
              .foregroundStyle(Color(hex: "#8B7355").opacity(0.6))
            Text(durationLabel)
              .font(.subheadline)
              .foregroundStyle(Color(hex: "#8B7355").opacity(0.8))
          }
        }

        if let session = entry.sessionData, let total = session.todayTotalMinutes, total > 0 {
          Text("Today: \(total)m focused")
            .font(.caption)
            .foregroundStyle(Color(hex: "#8B7355").opacity(0.8))
        }
      }

      Spacer()

      // Start button — runs StartSessionIntent directly (no app open)
      if #available(iOS 17.0, *) {
        Button(intent: StartSessionIntent(tagId: entry.configuredTagId, duration: entry.configuredTagDuration)) {
          VStack(spacing: 4) {
            Image(systemName: "play.fill")
              .font(.title2)
            Text("Start")
              .font(.caption2)
              .fontWeight(.medium)
          }
          .foregroundStyle(.white)
          .frame(width: 56, height: 56)
          .background(Color(hex: "#4CAF7C"), in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
      }
    }
    .padding(16)
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
