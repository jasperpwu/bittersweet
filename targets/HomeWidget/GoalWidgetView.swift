import SwiftUI
import WidgetKit

struct GoalWidgetView: View {
  let entry: GoalWidgetEntry

  @Environment(\.colorScheme) var colorScheme
  @Environment(\.widgetFamily) var family

  // MARK: - Adaptive Colors (matches HomeScreenWidgetView)

  private var widgetBg: Color {
    colorScheme == .dark ? Color(hex: "#1B1C30") : Color(hex: "#F5E6D3")
  }
  private var primaryText: Color {
    colorScheme == .dark ? .white : Color(hex: "#5D4E37")
  }
  private var secondaryText: Color {
    colorScheme == .dark ? Color(hex: "#CACACA") : Color(hex: "#6B5A42")
  }
  private var trackBg: Color {
    colorScheme == .dark ? Color(hex: "#2A2B45") : Color(hex: "#E0D0BC")
  }
  private var percentBadgeBg: Color {
    colorScheme == .dark ? Color(hex: "#2A2B45") : Color(hex: "#E0D0BC")
  }

  // MARK: - Progress Bar Constants

  private let goalThresholdPercent: Double = 84
  private let goalOverflowPercent: Double = 16

  var body: some View {
    Group {
      if entry.goals.isEmpty {
        emptyStateView
      } else {
        goalsListView
      }
    }
    .widgetURL(URL(string: "bittersweet-mobile://insights"))
    .widgetBackground(widgetBg)
  }

  // MARK: - Empty State

  private var emptyStateView: some View {
    VStack(spacing: 6) {
      Text("No active goals")
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(primaryText)
      Text("Set goals in the Insights tab")
        .font(.system(size: 13))
        .foregroundStyle(secondaryText)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  // MARK: - Goals List

  private var maxGoals: Int {
    family == .systemLarge ? 6 : 3
  }

  private var listSpacing: CGFloat {
    family == .systemLarge ? 12 : 8
  }

  private var goalsListView: some View {
    VStack(spacing: listSpacing) {
      ForEach(Array(entry.goals.prefix(maxGoals).enumerated()), id: \.offset) { _, goal in
        goalRow(goal: goal)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .padding(.horizontal, 2)
  }

  // MARK: - Goal Row

  private func goalRow(goal: WidgetGoalItem) -> some View {
    VStack(spacing: 4) {
      HStack(spacing: 0) {
        // Circular percentage badge
        ZStack {
          Circle()
            .fill(percentBadgeBg)
            .frame(width: 30, height: 30)
          Text("\(Int(goal.percentage))%")
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(primaryText)
        }
        .padding(.trailing, 8)

        // Goal name + progress text
        VStack(alignment: .leading, spacing: 1) {
          Text(goal.name)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(primaryText)
            .lineLimit(1)

          Text("\(formatTime(goal.currentMinutes)) / \(formatTime(goal.targetMinutes))")
            .font(.system(size: 10))
            .foregroundStyle(secondaryText)
            .lineLimit(1)
        }

        Spacer()

        // Period badge
        Text(goal.period)
          .font(.system(size: 10, weight: .medium))
          .foregroundStyle(.white)
          .padding(.horizontal, 8)
          .padding(.vertical, 3)
          .background(Color(hex: "#3B82F6"), in: Capsule())
      }

      // Progress bar
      progressBar(goal: goal)
    }
  }

  // MARK: - Progress Bar

  private func progressBar(goal: WidgetGoalItem) -> some View {
    let segments = getBarSegments(currentMinutes: goal.currentMinutes, targetMinutes: goal.targetMinutes)
    let isComplete = goal.percentage >= 100
    let fillColor = isComplete ? Color(hex: "#C6EFCE") : Color(hex: "#6592E9")

    return GeometryReader { geo in
      ZStack(alignment: .leading) {
        // Track background
        RoundedRectangle(cornerRadius: 3)
          .fill(trackBg)

        // Main progress fill
        if segments.progressWidth > 0 {
          RoundedRectangle(cornerRadius: 3)
            .fill(fillColor)
            .frame(width: geo.size.width * segments.progressWidth / 100)
        }

        // Overflow (orange) fill
        if segments.exceededWidth > 0 {
          RoundedRectangle(cornerRadius: 0)
            .fill(Color.orange)
            .frame(width: geo.size.width * segments.exceededWidth / 100)
            .offset(x: geo.size.width * goalThresholdPercent / 100)
        }

        // Threshold divider line at 84%
        Rectangle()
          .fill(Color.white.opacity(0.9))
          .frame(width: 1.5)
          .offset(x: geo.size.width * goalThresholdPercent / 100)
      }
    }
    .frame(height: 5)
    .clipShape(RoundedRectangle(cornerRadius: 3))
  }

  // MARK: - Helpers

  private func getBarSegments(currentMinutes: Double, targetMinutes: Double) -> (progressWidth: Double, exceededWidth: Double) {
    guard targetMinutes > 0 else { return (0, 0) }

    let progressWidth = min(
      (currentMinutes / targetMinutes) * goalThresholdPercent,
      goalThresholdPercent
    )
    let exceededWidth = currentMinutes > targetMinutes
      ? min(
        ((currentMinutes - targetMinutes) / targetMinutes) * goalThresholdPercent,
        goalOverflowPercent
      )
      : 0

    return (progressWidth, exceededWidth)
  }

  private func formatTime(_ minutes: Double) -> String {
    let rounded = Int(minutes.rounded())
    let hours = rounded / 60
    let mins = rounded % 60
    if hours > 0 {
      return "\(hours)h \(mins)m"
    }
    return "\(mins)m"
  }
}
