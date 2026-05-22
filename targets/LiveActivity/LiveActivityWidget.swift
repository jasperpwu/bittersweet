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
}

struct LiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LiveActivityAttributes.self) { context in
      if context.isStale, context.attributes.sessionType == "unlock" {
        // Unlock session expired — show "Unblock Expired" (no bonus time)
        VStack(alignment: .leading) {
          HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
              Text("Unblock Expired")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundStyle(Color(hex: context.attributes.titleColor ?? "#8B4513"))
            }
            Spacer()
            resizableImage(imageName: context.state.imageName ?? "default-coffee-bean")
              .frame(maxWidth: 48, maxHeight: 48)
          }
        }
        .padding(24)
        .activityBackgroundTint(
          context.attributes.backgroundColor.map { Color(hex: $0) }
        )
        .activitySystemActionForegroundColor(Color.black)
        .applyWidgetURL(from: context.attributes.deepLinkUrl)
      } else if context.isStale {
        // Focus session expired — show bonus time count-up
        VStack(alignment: .leading) {
          HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
              Text(context.state.title)
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundStyle(Color(hex: context.attributes.titleColor ?? "#8B4513"))
              Text("Bonus Time")
                .font(.title3)
                .foregroundStyle(Color(hex: context.attributes.subtitleColor ?? "#8B4513").opacity(0.7))
            }
            Spacer()
            resizableImage(imageName: context.state.imageName ?? "default-coffee-bean")
              .frame(maxWidth: 48, maxHeight: 48)
          }

          HStack {
            if let endDate = context.state.timerEndDateInMilliseconds {
              // Date is in the past, so Text(.timer) counts UP automatically
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
                  .foregroundStyle(Color(hex: "#8B4513"))
                  .padding(.horizontal, 20)
                  .padding(.vertical, 8)
                  .background(Color(hex: "#E0E0E0").opacity(0.5))
                  .clipShape(Capsule())
              }
              .buttonStyle(.plain)
            }
          }
        }
        .padding(24)
        .activityBackgroundTint(
          context.attributes.backgroundColor.map { Color(hex: $0) }
        )
        .activitySystemActionForegroundColor(Color.black)
        .applyWidgetURL(from: context.attributes.deepLinkUrl)
      } else {
        LiveActivityView(contentState: context.state, attributes: context.attributes)
          .activityBackgroundTint(
            context.attributes.backgroundColor.map { Color(hex: $0) }
          )
          .activitySystemActionForegroundColor(Color.black)
          .applyWidgetURL(from: context.attributes.deepLinkUrl)
      }
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
            HStack {
              Spacer()
              if #available(iOS 17.0, *) {
                Button(intent: StartSessionIntent(
                  tagId: context.state.tagId,
                  duration: context.state.durationMinutes
                )) {
                  Text("Start")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color(hex: "#8B4513"))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 8)
                    .background(Color(hex: "#E0E0E0").opacity(0.5))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
              }
            }
            .padding(.horizontal, 5)
          } else if let date = context.state.timerEndDateInMilliseconds {
            HStack {
              dynamicIslandExpandedBottom(
                endDate: date, startDateMs: context.state.timerStartDateInMilliseconds, progressViewTint: context.attributes.progressViewTint
              )

              Spacer()

              if #available(iOS 17.0, *) {
                Button(intent: StopSessionIntent()) {
                  Text("End")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color(hex: "#8B4513"))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 6)
                    .background(Color(hex: "#E0E0E0").opacity(0.5))
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
              }
            }
            .padding(.horizontal, 5)
            .applyWidgetURL(from: context.attributes.deepLinkUrl)
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
        .frame(maxHeight: 64)
      Spacer()
    }
  }

  @ViewBuilder
  private func dynamicIslandExpandedBottom(endDate: Double, startDateMs: Double?, progressViewTint: String?) -> some View {
    let target = Date(timeIntervalSince1970: endDate / 1000)
    if target <= Date.now {
      // Past date: show elapsed time count-up (infinite mode)
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
