import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

struct LiveActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String?
    var timerEndDateInMilliseconds: Double?
    var timerStartDateInMilliseconds: Double?
    var progress: Double?
    var imageName: String?
    var dynamicIslandImageName: String?
    var dynamicIslandText: String?
    var isIdle: Bool?
    var tagId: String?
    var durationMinutes: Int?
  }

  var name: String
  var backgroundColor: String?
  var titleColor: String?
  var subtitleColor: String?
  var progressViewTint: String?
  var progressViewLabelColor: String?
  var deepLinkUrl: String?
  var timerType: DynamicIslandTimerType?
  var sessionType: String?

  enum DynamicIslandTimerType: String, Codable {
    case circular
    case digital
  }

  /// Whether the JS-provided background color is a dark color
  var isDarkBackground: Bool {
    backgroundColor == "#1B1C30"
  }
}

// MARK: - Adaptive Banner Wrapper

struct LiveActivityBannerWrapper: View {
  let contentState: LiveActivityAttributes.ContentState
  let attributes: LiveActivityAttributes

  var body: some View {
    LiveActivityView(contentState: contentState, attributes: attributes)
      .activitySystemActionForegroundColor(Color(hex: attributes.titleColor ?? "#8B4513"))
  }
}

// MARK: - Stale Unlock Banner

struct StaleUnlockBannerView: View {
  let attributes: LiveActivityAttributes
  let state: LiveActivityAttributes.ContentState

  private var textColor: Color { Color(hex: attributes.titleColor ?? "#8B4513") }
  private var bgColor: Color { Color(hex: attributes.backgroundColor ?? "#F5E6D3") }

  var body: some View {
    VStack(alignment: .leading) {
      HStack(alignment: .center) {
        VStack(alignment: .leading, spacing: 2) {
          Text("Unblock Expired")
            .font(.title2)
            .fontWeight(.semibold)
            .foregroundStyle(textColor)
        }
        Spacer()
        resizableImage(imageName: state.imageName ?? "default-coffee-bean")
          .frame(maxWidth: 48, maxHeight: 48)
      }
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(bgColor)
    .activitySystemActionForegroundColor(textColor)
  }
}

// MARK: - Stale Bonus Banner

struct StaleBonusBannerView: View {
  let attributes: LiveActivityAttributes
  let state: LiveActivityAttributes.ContentState

  private var textColor: Color { Color(hex: attributes.titleColor ?? "#8B4513") }
  private var subtitleTextColor: Color { Color(hex: attributes.subtitleColor ?? "#8B4513") }
  private var bgColor: Color { Color(hex: attributes.backgroundColor ?? "#F5E6D3") }
  private var buttonTextColor: Color { attributes.isDarkBackground ? .white : Color(hex: "#8B4513") }
  private var buttonBgColor: Color { attributes.isDarkBackground ? Color.white.opacity(0.2) : Color(hex: "#E0E0E0").opacity(0.5) }

  var body: some View {
    VStack(alignment: .leading) {
      HStack(alignment: .center) {
        VStack(alignment: .leading, spacing: 2) {
          Text(state.title)
            .font(.title2)
            .fontWeight(.semibold)
            .foregroundStyle(textColor)
          Text("Bonus Time")
            .font(.title3)
            .foregroundStyle(subtitleTextColor.opacity(0.7))
        }
        Spacer()
        resizableImage(imageName: state.imageName ?? "default-coffee-bean")
          .frame(maxWidth: 48, maxHeight: 48)
      }

      HStack {
        if let endDate = state.timerEndDateInMilliseconds {
          HStack(spacing: 4) {
            Text("+")
            Text(Date(timeIntervalSince1970: endDate / 1000), style: .timer)
          }
          .font(.system(size: 28, weight: .bold, design: .monospaced))
          .minimumScaleFactor(0.8)
          .multilineTextAlignment(.leading)
          .foregroundStyle(Color(hex: "#4CAF7C"))
        }

        Spacer()

        if #available(iOS 17.0, *) {
          Button(intent: StopSessionIntent()) {
            Text("End")
              .font(.title3)
              .fontWeight(.semibold)
              .foregroundStyle(buttonTextColor)
              .padding(.horizontal, 20)
              .padding(.vertical, 8)
              .background(buttonBgColor)
              .clipShape(Capsule())
          }
          .buttonStyle(.plain)
        }
      }
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(bgColor)
    .activitySystemActionForegroundColor(textColor)
  }
}

// MARK: - Apple Watch Smart Stack View

struct WatchActivityView: View {
  let contentState: LiveActivityAttributes.ContentState
  let attributes: LiveActivityAttributes
  let isStale: Bool

  var body: some View {
    if isStale, attributes.sessionType == "unlock" {
      watchStaleUnlockView
    } else if isStale {
      watchBonusView
    } else if contentState.isIdle == true {
      watchIdleView
    } else if attributes.sessionType == "unlock" {
      watchUnlockView
    } else {
      watchActiveView
    }
  }

  // MARK: - Idle: tag name + duration + play glyph

  private var watchIdleView: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(contentState.title)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(.primary)
        .lineLimit(1)

      HStack {
        if let subtitle = contentState.subtitle {
          Text(subtitle)
            .font(.system(size: 28, weight: .bold, design: subtitle == "∞" ? .rounded : .monospaced))
            .foregroundStyle(.primary)
            .minimumScaleFactor(0.7)
        }

        Spacer()

        Button(intent: StartSessionIntent(
          tagId: contentState.tagId,
          duration: contentState.durationMinutes
        )) {
          Image(systemName: "play.fill")
            .font(.system(size: 18))
            .foregroundStyle(.white)
            .frame(width: 36, height: 36)
            .background(.tint, in: Circle())
        }
        .buttonStyle(.plain)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }

  // MARK: - Active: tag name + timer + stop glyph

  private var watchActiveView: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(contentState.title)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(.primary)
        .lineLimit(1)

      HStack {
        if let date = contentState.timerEndDateInMilliseconds {
          let target = Date(timeIntervalSince1970: date / 1000)
          if target <= Date.now {
            // Count up (infinite / elapsed)
            Text(target, style: .timer)
              .font(.system(size: 28, weight: .bold, design: .monospaced))
              .foregroundStyle(.primary)
              .minimumScaleFactor(0.7)
          } else {
            // Count down
            let startDate: Date = {
              if let ms = contentState.timerStartDateInMilliseconds {
                return Date(timeIntervalSince1970: ms / 1000)
              }
              return Date.now
            }()
            Text(timerInterval: startDate...target, countsDown: true, showsHours: false)
              .font(.system(size: 28, weight: .bold, design: .monospaced))
              .foregroundStyle(.primary)
              .minimumScaleFactor(0.7)
          }
        }

        Spacer()

        Button(intent: StopSessionIntent()) {
          Image(systemName: "stop.fill")
            .font(.system(size: 18))
            .foregroundStyle(.white)
            .frame(width: 36, height: 36)
            .background(.red, in: Circle())
        }
        .buttonStyle(.plain)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }

  // MARK: - Unlock: "Unlocked" + timer + stop glyph

  private var watchUnlockView: some View {
    VStack(alignment: .leading, spacing: 4) {
      HStack(spacing: 4) {
        Text("\u{1F513}")
          .font(.system(size: 13))
        Text("Unlocked")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(Color(hex: "#4CAF7C"))
          .lineLimit(1)
      }

      HStack {
        if let date = contentState.timerEndDateInMilliseconds {
          let target = Date(timeIntervalSince1970: date / 1000)
          Text(timerInterval: Date()...max(target, Date().addingTimeInterval(1)), countsDown: true, showsHours: false)
            .font(.system(size: 28, weight: .bold, design: .monospaced))
            .foregroundStyle(.primary)
            .minimumScaleFactor(0.7)
        }

        Spacer()

        Button(intent: StopUnlockIntent()) {
          Image(systemName: "stop.fill")
            .font(.system(size: 18))
            .foregroundStyle(.white)
            .frame(width: 36, height: 36)
            .background(Color(hex: "#B22222"), in: Circle())
        }
        .buttonStyle(.plain)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }

  // MARK: - Stale Bonus: tag name + green count-up + stop glyph

  private var watchBonusView: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(contentState.title)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(.primary)
        .lineLimit(1)

      HStack {
        if let date = contentState.timerEndDateInMilliseconds {
          HStack(spacing: 2) {
            Text("+")
            Text(Date(timeIntervalSince1970: date / 1000), style: .timer)
          }
          .font(.system(size: 28, weight: .bold, design: .monospaced))
          .foregroundStyle(Color(hex: "#4CAF7C"))
          .minimumScaleFactor(0.7)
        }

        Spacer()

        Button(intent: StopSessionIntent()) {
          Image(systemName: "stop.fill")
            .font(.system(size: 18))
            .foregroundStyle(.white)
            .frame(width: 36, height: 36)
            .background(.red, in: Circle())
        }
        .buttonStyle(.plain)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }

  // MARK: - Stale Unlock Expired

  private var watchStaleUnlockView: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Unblock Expired")
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(.primary)
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Content Router (phone vs watch)

struct LiveActivityContentRouter: View {
  @Environment(\.activityFamily) var activityFamily
  let contentState: LiveActivityAttributes.ContentState
  let attributes: LiveActivityAttributes
  let isStale: Bool

  var body: some View {
    switch activityFamily {
    case .small:
      WatchActivityView(contentState: contentState, attributes: attributes, isStale: isStale)
    case .medium:
      phoneView
    @unknown default:
      phoneView
    }
  }

  @ViewBuilder
  private var phoneView: some View {
    if isStale, attributes.sessionType == "unlock" {
      StaleUnlockBannerView(attributes: attributes, state: contentState)
    } else if isStale {
      StaleBonusBannerView(attributes: attributes, state: contentState)
    } else {
      LiveActivityBannerWrapper(contentState: contentState, attributes: attributes)
    }
  }
}

// MARK: - Dynamic Island Bottom Views

struct DynamicIslandIdleBottomView: View {
  let tagId: String?
  let durationMinutes: Int?

  var body: some View {
    HStack {
      Spacer()
      if #available(iOS 17.0, *) {
        Button(intent: StartSessionIntent(
          tagId: tagId,
          duration: durationMinutes
        )) {
          Text("Start")
            .font(.title3)
            .fontWeight(.semibold)
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
            .background(Color.white.opacity(0.2))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
      }
    }
    .padding(.horizontal, 5)
  }
}

struct DynamicIslandActiveBottomView: View {
  let endDate: Double
  let startDateMs: Double?
  let progressViewTint: String?
  let sessionType: String?
  let deepLinkUrl: String?

  var body: some View {
    HStack {
      dynamicIslandExpandedBottomContent

      Spacer()

      if #available(iOS 17.0, *) {
        if sessionType == "unlock" {
          Button(intent: StopUnlockIntent()) {
            adaptiveEndButtonLabel(fontSize: .subheadline, hPad: 16, vPad: 6)
          }
          .buttonStyle(.plain)
        } else {
          Button(intent: StopSessionIntent()) {
            adaptiveEndButtonLabel(fontSize: .subheadline, hPad: 16, vPad: 6)
          }
          .buttonStyle(.plain)
        }
      }
    }
    .padding(.horizontal, 5)
    .applyWidgetURL(from: deepLinkUrl)
  }

  private func adaptiveEndButtonLabel(fontSize: Font, hPad: CGFloat, vPad: CGFloat) -> some View {
    Text("End")
      .font(fontSize)
      .fontWeight(.semibold)
      .foregroundStyle(.white)
      .padding(.horizontal, hPad)
      .padding(.vertical, vPad)
      .background(Color.white.opacity(0.2))
      .clipShape(Capsule())
  }

  @ViewBuilder
  private var dynamicIslandExpandedBottomContent: some View {
    let target = Date(timeIntervalSince1970: endDate / 1000)
    if target <= Date.now {
      Text(target, style: .timer)
        .font(.system(size: 20, weight: .bold, design: .monospaced))
        .foregroundStyle(.white)
        .padding(.top, 5)
    } else {
      let startDate: Date = {
        if let ms = startDateMs { return Date(timeIntervalSince1970: ms / 1000) }
        return Date.now
      }()
      ProgressView(timerInterval: startDate...target)
        .foregroundStyle(.white)
        .tint(progressViewTint.map { Color(hex: $0) })
        .padding(.top, 5)
    }
  }
}

struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      LiveActivityContentRouter(
        contentState: context.state,
        attributes: context.attributes,
        isStale: context.isStale
      )
      .applyWidgetURL(from: context.attributes.deepLinkUrl)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading, priority: 1) {
          dynamicIslandExpandedLeading(title: context.state.title, subtitle: context.state.subtitle)
            .dynamicIsland(verticalPlacement: .belowIfTooWide)
            .padding(.leading, 5)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.trailing) {
          dynamicIslandExpandedTrailing(imageName: {
            let imageName = context.state.imageName ?? "default-coffee-bean"
            if context.state.imageName == nil {
              NSLog("[LiveActivity] Using default coffee bean image for Dynamic Island expanded")
            } else {
              NSLog("[LiveActivity] Using custom image for Dynamic Island expanded: \(context.state.imageName!)")
            }
            return imageName
          }())
            .padding(.trailing, 5)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
        DynamicIslandExpandedRegion(.bottom) {
          if context.state.isIdle == true {
            DynamicIslandIdleBottomView(
              tagId: context.state.tagId,
              durationMinutes: context.state.durationMinutes
            )
          } else if let date = context.state.timerEndDateInMilliseconds {
            DynamicIslandActiveBottomView(
              endDate: date,
              startDateMs: context.state.timerStartDateInMilliseconds,
              progressViewTint: context.attributes.progressViewTint,
              sessionType: context.attributes.sessionType,
              deepLinkUrl: context.attributes.deepLinkUrl
            )
          }
        }
      } compactLeading: {
        HStack(spacing: 4) {
          resizableImage(imageName: {
            let imageName = context.state.dynamicIslandImageName ?? "default-coffee-bean"
            if context.state.dynamicIslandImageName == nil {
              NSLog("[LiveActivity] Using default coffee bean image for Dynamic Island compact")
            } else {
              NSLog("[LiveActivity] Using custom image for Dynamic Island compact: \(context.state.dynamicIslandImageName!)")
            }
            return imageName
          }())
            .frame(maxWidth: 23, maxHeight: 23)

          if let dynamicIslandText = context.state.dynamicIslandText {
            Text(dynamicIslandText)
              .font(.system(size: 15))
              .minimumScaleFactor(0.8)
              .fontWeight(.semibold)
              .lineLimit(1)
          }
        }
        .applyWidgetURL(from: context.attributes.deepLinkUrl)
      } compactTrailing: {
        if context.state.isIdle == true {
          Image(systemName: "play.fill")
            .font(.system(size: 14))
            .foregroundStyle(.white)
        } else if context.isStale, context.attributes.sessionType == "unlock" {
          // Unlock expired
          Text("Expired")
            .font(.system(size: 14))
            .fontWeight(.semibold)
        } else if context.isStale, let date = context.state.timerEndDateInMilliseconds {
          // Focus session — count up from the expired end date
          Text(Date(timeIntervalSince1970: date / 1000), style: .timer)
            .font(.system(size: 15))
            .minimumScaleFactor(0.8)
            .fontWeight(.semibold)
            .foregroundStyle(Color(hex: "#4CAF7C"))
            .frame(maxWidth: 60)
            .multilineTextAlignment(.trailing)
        } else if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            startDateMs: context.state.timerStartDateInMilliseconds,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      } minimal: {
        if context.state.isIdle == true {
          Image(systemName: "play.fill")
            .font(.system(size: 14))
            .foregroundStyle(.white)
        } else if context.isStale, context.attributes.sessionType == "unlock" {
          // Unlock expired
          Image(systemName: "lock.fill")
            .font(.system(size: 14))
        } else if context.isStale, let date = context.state.timerEndDateInMilliseconds {
          // Focus session — count up from the expired end date
          Text(Date(timeIntervalSince1970: date / 1000), style: .timer)
            .font(.system(size: 14))
            .fontWeight(.semibold)
            .foregroundStyle(Color(hex: "#4CAF7C"))
        } else if let date = context.state.timerEndDateInMilliseconds {
          compactTimer(
            endDate: date,
            startDateMs: context.state.timerStartDateInMilliseconds,
            timerType: context.attributes.timerType ?? .circular,
            progressViewTint: context.attributes.progressViewTint
          ).applyWidgetURL(from: context.attributes.deepLinkUrl)
        }
      }
    }
    .supplementalActivityFamilies([.small])
  }

  @ViewBuilder
  private func compactTimer(
    endDate: Double,
    startDateMs: Double?,
    timerType: LiveActivityAttributes.DynamicIslandTimerType,
    progressViewTint: String?
  ) -> some View {
    let target = Date(timeIntervalSince1970: endDate / 1000)
    if target <= Date.now {
      // Past date: count UP (infinite/elapsed mode)
      Text(target, style: .timer)
        .font(.system(size: 15))
        .minimumScaleFactor(0.8)
        .fontWeight(.semibold)
        .frame(maxWidth: 60)
        .multilineTextAlignment(.trailing)
    } else if timerType == .digital {
      // Use timerInterval with real start date so the countdown is deterministic
      // and stays in sync with the home-screen widget timer.
      let startDate: Date = {
        if let ms = startDateMs { return Date(timeIntervalSince1970: ms / 1000) }
        return Date.now
      }()
      Text(timerInterval: startDate...target, countsDown: true, showsHours: false)
        .font(.system(size: 15))
        .minimumScaleFactor(0.8)
        .fontWeight(.semibold)
        .frame(maxWidth: 60)
        .multilineTextAlignment(.trailing)
    } else {
      circularTimer(endDate: endDate)
        .tint(progressViewTint.map { Color(hex: $0) })
    }
  }

  private func dynamicIslandExpandedLeading(title: String, subtitle: String?) -> some View {
    VStack(alignment: .leading) {
      Spacer()
      Text(title)
        .font(.title2)
        .foregroundStyle(.white)
        .fontWeight(.semibold)
      if let subtitle {
        Text(subtitle)
          .font(.title3)
          .minimumScaleFactor(0.8)
          .foregroundStyle(.white.opacity(0.75))
      }
      Spacer()
    }
  }

  private func dynamicIslandExpandedTrailing(imageName: String) -> some View {
    VStack {
      Spacer()
      resizableImage(imageName: imageName)
        .frame(maxWidth: 48, maxHeight: 48)
      Spacer()
    }
  }

  private func circularTimer(endDate: Double) -> some View {
    ProgressView(
      timerInterval: Date.toTimerInterval(miliseconds: endDate),
      countsDown: false,
      label: { EmptyView() },
      currentValueLabel: {
        EmptyView()
      }
    )
    .progressViewStyle(.circular)
  }
}

