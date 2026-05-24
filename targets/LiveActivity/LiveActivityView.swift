import SwiftUI
import WidgetKit

#if canImport(ActivityKit)
import AppIntents

  struct ConditionalForegroundViewModifier: ViewModifier {
    let color: String?

    func body(content: Content) -> some View {
      if let color = color {
        content.foregroundStyle(Color(hex: color))
      } else {
        content
      }
    }
  }

  struct LiveActivityView: View {
    let contentState: LiveActivityAttributes.ContentState
    let attributes: LiveActivityAttributes

    var progressViewTint: Color? {
      attributes.progressViewTint.map { Color(hex: $0) }
    }

    var body: some View {
      if contentState.isIdle == true {
        idleView
      } else {
        activeView
      }
    }

    // MARK: - Idle State (tag name + last duration + Start button)

    private var idleView: some View {
      VStack(alignment: .leading, spacing: 3) {
        HStack(alignment: .top) {
          Text(contentState.title)
            .font(.system(size: 20, weight: .semibold))
            .modifier(ConditionalForegroundViewModifier(color: attributes.titleColor))

          Spacer()

          resizableImage(imageName: contentState.imageName ?? "default-coffee-bean")
            .frame(maxWidth: 48, maxHeight: 48)
        }

        HStack {
          if let subtitle = contentState.subtitle {
            Text(subtitle)
              .font(.system(size: 36, weight: .bold, design: subtitle == "∞" ? .rounded : .monospaced))
              .minimumScaleFactor(0.8)
              .multilineTextAlignment(.leading)
              .modifier(ConditionalForegroundViewModifier(color: attributes.progressViewLabelColor))
              .padding(.leading, 3)
              .offset(y: -5)
          }

          Spacer()

          if #available(iOS 17.0, *) {
            Button(intent: StartSessionIntent(
              tagId: contentState.tagId,
              duration: contentState.durationMinutes
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
      }
      .padding(24)
    }

    // MARK: - Active State (timer + End button)

    private var activeView: some View {
      VStack(alignment: .leading, spacing: 8) {
        HStack(alignment: .center) {
          VStack(alignment: .leading, spacing: 2) {
            Text(contentState.title)
              .font(.title2)
              .fontWeight(.semibold)
              .modifier(ConditionalForegroundViewModifier(color: attributes.titleColor))

            if let subtitle = contentState.subtitle {
              Text(subtitle)
                .font(.title3)
                .modifier(ConditionalForegroundViewModifier(color: attributes.subtitleColor))
            }
          }

          Spacer()

          resizableImage(imageName: {
            let imageName = contentState.imageName ?? "default-coffee-bean"
            if contentState.imageName == nil {
              NSLog("[LiveActivity] Using default coffee bean image for banner")
            } else {
              NSLog("[LiveActivity] Using custom image for banner: \(contentState.imageName!)")
            }
            return imageName
          }())
            .frame(maxWidth: 48, maxHeight: 48)
        }

        HStack {
          if let date = contentState.timerEndDateInMilliseconds {
            let target = Date(timeIntervalSince1970: date / 1000)
            if target <= Date.now {
              // Past date: count UP from that time (infinite/elapsed mode)
              Text(target, style: .timer)
                .font(.system(size: 28, weight: .bold, design: .monospaced))
                .minimumScaleFactor(0.8)
                .multilineTextAlignment(.leading)
                .modifier(ConditionalForegroundViewModifier(color: attributes.progressViewLabelColor))
            } else {
              // Future date: count DOWN to that time (normal mode)
              let startDate: Date = {
                if let startMs = contentState.timerStartDateInMilliseconds {
                  return Date(timeIntervalSince1970: startMs / 1000)
                }
                return Date.now
              }()
              Text(timerInterval: startDate...target, countsDown: true, showsHours: false)
                .font(.system(size: 28, weight: .bold, design: .monospaced))
                .minimumScaleFactor(0.8)
                .multilineTextAlignment(.leading)
                .modifier(ConditionalForegroundViewModifier(color: attributes.progressViewLabelColor))
            }
          } else if let progress = contentState.progress {
            ProgressView(value: progress)
              .tint(progressViewTint)
              .modifier(ConditionalForegroundViewModifier(color: attributes.progressViewLabelColor))
          }

          Spacer()

          if #available(iOS 17.0, *) {
            if attributes.sessionType == "unlock" {
              Button(intent: StopUnlockIntent()) {
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
            } else {
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
      }
      .padding(24)
    }
  }

#endif
