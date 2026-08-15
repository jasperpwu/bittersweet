import ExpoModulesCore
import CoreMotion

/**
 * MotionInsights — Core Motion signals for the focus-rating feature.
 *
 * Signal: CMMotionActivity — stationary/walking/running classification, queryable
 * retroactively over any window. This is the sole rating input.
 *
 * NOTE: deliberately does NOT hold a `CMSensorRecorder`. Allocating one triggers
 * the iOS Motion & Fitness prompt at *object construction* — and Expo instantiates
 * this module at launch — so a stored recorder popped the permission dialog on
 * every fresh install/reinstall, unprompted and with no session. The recorder
 * path was also dead (never started, always returned empty), so it's gone.
 */
public class MotionInsightsModule: Module {
  private let activityManager = CMMotionActivityManager()
  private let queue = OperationQueue()

  public func definition() -> ModuleDefinition {
    Name("MotionInsights")

    // Summarise CMMotionActivity over [startMs, endMs] into per-state seconds.
    AsyncFunction("getMotionActivitySummary") { (startMs: Double, endMs: Double, promise: Promise) in
      guard CMMotionActivityManager.isActivityAvailable() else {
        promise.resolve(nil)
        return
      }
      let start = Date(timeIntervalSince1970: startMs / 1000.0)
      let end = Date(timeIntervalSince1970: endMs / 1000.0)

      self.activityManager.queryActivityStarting(from: start, to: end, to: self.queue) { activities, _ in
        guard let activities = activities, !activities.isEmpty else {
          promise.resolve(nil)
          return
        }

        var stationary = 0.0, walking = 0.0, running = 0.0, cycling = 0.0, automotive = 0.0, unknown = 0.0

        for (i, activity) in activities.enumerated() {
          let segStart = max(activity.startDate, start)
          let segEnd = i + 1 < activities.count ? activities[i + 1].startDate : end
          let seconds = max(0, segEnd.timeIntervalSince(segStart))
          if seconds == 0 { continue }

          // Dominant classification for the segment.
          if activity.running { running += seconds }
          else if activity.cycling { cycling += seconds }
          else if activity.walking { walking += seconds }
          else if activity.automotive { automotive += seconds }
          else if activity.stationary { stationary += seconds }
          else { unknown += seconds }
        }

        let total = stationary + walking + running + cycling + automotive + unknown
        promise.resolve([
          "stationarySec": stationary,
          "walkingSec": walking,
          "runningSec": running,
          "cyclingSec": cycling,
          "automotiveSec": automotive,
          "unknownSec": unknown,
          "totalSec": total,
        ])
      }
    }
  }
}
