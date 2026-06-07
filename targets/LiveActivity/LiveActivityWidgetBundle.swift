import SwiftUI
import WidgetKit

@main
struct LiveActivityWidgetBundle: WidgetBundle {
  var body: some Widget {
    LiveActivityWidget()
    SmallFocusWidget()
    MediumFocusWidget()
    GoalWidget()
  }
}
