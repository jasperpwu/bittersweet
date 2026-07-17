import SwiftUI
import WidgetKit

#if canImport(ActivityKit)
import AppIntents

  struct LiveActivityView: View {
    let contentState: LiveActivityAttributes.ContentState
    let attributes: LiveActivityAttributes

    // MARK: - Colors derived from attributes (set by JS based on system appearance)

    private var bgColor: Color {
      Color(hex: attributes.backgroundColor ?? "#F5E6D3")
    }

    private var titleColor: Color {
      Color(hex: attributes.titleColor ?? "#8B4513")
    }

    private var subtitleColor: Color {
      Color(hex: attributes.subtitleColor ?? "#8B4513")
    }

    private var buttonTextColor: Color {
      // Derive from background: dark bg → white text, light bg → brown text
      isDarkBg ? .white : Color(hex: "#8B4513")
    }

    private var buttonBgColor: Color {
      isDarkBg ? Color.white.opacity(0.2) : Color(hex: "#E0E0E0").opacity(0.5)
    }

    private var isDarkBg: Bool {
      attributes.backgroundColor == "#1B1C30"
    }

    var progressViewTint: Color? {
      attributes.progressViewTint.map { Color(hex: $0) }
    }

    var body: some View {
      Group {
        if contentState.isIdle == true {
          idleView
        } else {
          activeView
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(bgColor)
    }

    // MARK: - Idle State (tag name + last duration + Start button)

    private var idleView: some View {
      VStack(alignment: .leading, spacing: 3) {
        HStack(alignment: .top) {
          Text(contentState.title)
            .font(.system(size: 20, weight: .semibold))
            .foregroundStyle(titleColor)

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
              .foregroundStyle(titleColor)
              .padding(.leading, 3)
              .offset(y: -5)
          }

          Spacer()

          if #available(iOS 17.0, *) {
            Button(intent: StartSessionIntent(
              tagId: contentState.tagId,
              duration: contentState.durationMinutes
            )) {
              Text(contentState.startLabel ?? "Start")
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
    }

    // MARK: - Active State (timer + End button)

    private var activeView: some View {
      VStack(alignment: .leading, spacing: 8) {
        HStack(alignment: .center) {
          VStack(alignment: .leading, spacing: 2) {
            Text(contentState.title)
              .font(.title2)
              .fontWeight(.semibold)
              .foregroundStyle(titleColor)

            if let subtitle = contentState.subtitle {
              Text(subtitle)
                .font(.title3)
                .foregroundStyle(subtitleColor)
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
                .foregroundStyle(titleColor)
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
                .foregroundStyle(titleColor)
            }
          } else if let progress = contentState.progress {
            ProgressView(value: progress)
              .tint(progressViewTint)
              .foregroundStyle(titleColor)
          }

          Spacer()

          if #available(iOS 17.0, *) {
            if attributes.sessionType == "unlock" {
              Button(intent: StopUnlockIntent()) {
                Text(contentState.endLabel ?? "End")
                  .font(.title3)
                  .fontWeight(.semibold)
                  .foregroundStyle(buttonTextColor)
                  .padding(.horizontal, 20)
                  .padding(.vertical, 8)
                  .background(buttonBgColor)
                  .clipShape(Capsule())
              }
              .buttonStyle(.plain)
            } else {
              Button(intent: StopSessionIntent()) {
                Text(contentState.endLabel ?? "End")
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
      }
      .padding(24)
    }
  }

#endif
