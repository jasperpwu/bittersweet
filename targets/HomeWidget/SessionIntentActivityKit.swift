import ActivityKit
import FamilyControls
import Foundation
import ManagedSettings
import UIKit

// This file is ONLY compiled in the main app target (not the widget extension).
// It provides the real ActivityKit implementations for the WidgetActivityKit
// callback hooks defined in SessionIntent.swift.
//
// The system runs LiveActivityIntent.perform() in the main app process,
// so Activity.request() works here.
//
// LiveActivityAttributes is internal to the ExpoLiveActivity pod, so we define
// a matching copy here. ActivityKit matches activity types by struct name (not module),
// so this is compatible with the widget extension's copy in LiveActivityWidget.swift.

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
    var startLabel: String?
    var endLabel: String?
    var unlockedLabel: String?
    var unblockExpiredLabel: String?
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

// Discovered at runtime by WidgetActivityKit.registerIfNeeded() via NSClassFromString.
// This avoids compile-time references from SessionIntent.swift (which is compiled in
// both targets) to this file (which is only in the main app target).
@available(iOS 17.0, *)
@objc(WidgetActivityKitLoader)
class WidgetActivityKitLoader: NSObject {

  @objc class func registerHandlers() {
    WidgetActivityKit.startHandler = { tagName, duration, startTimeMs, endTimeMs, isInfinite in
      // Carry over the localized button labels from the activity being
      // replaced (JS supplies them on every update); native has no i18n.
      let prevState = Activity<LiveActivityAttributes>.activities.first?.content.state

      // End all existing activities first to prevent duplicates
      for activity in Activity<LiveActivityAttributes>.activities {
        let id = activity.id
        Task {
          await activity.end(nil, dismissalPolicy: .immediate)
          print("🧹 [Widget] Ended existing activity: \(id)")
        }
      }

      let subtitle: String? = isInfinite ? "∞ focus session" : "\(duration)m focus session"
      let timerDate: Double = isInfinite ? startTimeMs : endTimeMs

      let state = LiveActivityAttributes.ContentState(
        title: tagName,
        subtitle: subtitle,
        timerEndDateInMilliseconds: timerDate,
        timerStartDateInMilliseconds: startTimeMs,
        progress: nil,
        imageName: "app_icon",
        dynamicIslandImageName: "app_icon",
        dynamicIslandText: tagName,
        startLabel: prevState?.startLabel,
        endLabel: prevState?.endLabel,
        unlockedLabel: prevState?.unlockedLabel,
        unblockExpiredLabel: prevState?.unblockExpiredLabel
      )

      // Match JS-side palette (LA_COLORS in LiveActivityService.ts)
      let isDark = UITraitCollection.current.userInterfaceStyle == .dark
      let bgColor      = isDark ? "#1B1C30" : "#F5E6D3"
      let titleCol     = isDark ? "#FFFFFF" : "#8B4513"
      let subtitleCol  = isDark ? "#CACACA" : "#8B4513"
      let progressCol  = isDark ? "#FFFFFF" : "#8B4513"

      let attributes = LiveActivityAttributes(
        name: "focus",
        backgroundColor: bgColor,
        titleColor: titleCol,
        subtitleColor: subtitleCol,
        progressViewTint: "#FF6347",
        progressViewLabelColor: progressCol,
        // Empty path → bare scheme "bittersweet-mobile://" → Focus tab (root index).
        deepLinkUrl: "",
        timerType: .digital,
        sessionType: nil
      )

      let staleDate: Date? = isInfinite ? nil : Date(timeIntervalSince1970: endTimeMs / 1000)

      do {
        let activity = try Activity.request(
          attributes: attributes,
          content: ActivityContent(state: state, staleDate: staleDate),
          pushType: nil
        )
        print("✅ [Widget] Started Live Activity: \(activity.id)")
        return activity.id
      } catch {
        print("❌ [Widget] Failed to start Live Activity: \(error)")
        return nil
      }
    }

    WidgetActivityKit.reblockHandler = {
      // Re-block apps by reading the selection from UserDefaults and applying
      // it back via ManagedSettingsStore. This replicates what JS blockSelection()
      // does, but runs immediately from the native intent without waiting for JS.
      guard let selectionId = WidgetDataManager.shared.getCurrentSelectionId() else {
        return
      }

      let appGroupId = Bundle.main.object(forInfoDictionaryKey: "REACT_NATIVE_DEVICE_ACTIVITY_APP_GROUP") as? String
        ?? "group.com.path2us.bittersweet.appblocker"
      guard let ud = UserDefaults(suiteName: appGroupId) else {
        return
      }

      // Read the serialized FamilyActivitySelection for this ID
      guard let selectionIds = ud.dictionary(forKey: "familyActivitySelectionIds"),
            let selectionStr = selectionIds[selectionId] as? String,
            let data = Data(base64Encoded: selectionStr) else {
        return
      }

      // Deserialize the selection
      guard let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else {
        return
      }

      // Read current blocklist and add the selection back
      var currentBlocklist = FamilyActivitySelection()
      if let blocklistStr = ud.string(forKey: "currentBlockedSelection"),
         let blocklistData = Data(base64Encoded: blocklistStr) {
        currentBlocklist = (try? JSONDecoder().decode(FamilyActivitySelection.self, from: blocklistData)) ?? FamilyActivitySelection()
      }

      // Union: add the selection's tokens back to the blocklist
      var updatedBlocklist = FamilyActivitySelection()
      updatedBlocklist.applicationTokens = currentBlocklist.applicationTokens.union(selection.applicationTokens)
      updatedBlocklist.webDomainTokens = currentBlocklist.webDomainTokens.union(selection.webDomainTokens)
      updatedBlocklist.categoryTokens = currentBlocklist.categoryTokens.union(selection.categoryTokens)

      // Save updated blocklist
      if let encoded = try? JSONEncoder().encode(updatedBlocklist) {
        ud.set(encoded.base64EncodedString(), forKey: "currentBlockedSelection")
      }

      // Read current whitelist
      var currentWhitelist = FamilyActivitySelection()
      if let whitelistStr = ud.string(forKey: "currentUnblockedSelection"),
         let whitelistData = Data(base64Encoded: whitelistStr) {
        currentWhitelist = (try? JSONDecoder().decode(FamilyActivitySelection.self, from: whitelistData)) ?? FamilyActivitySelection()
      }

      // Apply shield via ManagedSettingsStore (same logic as react-native-device-activity's updateBlock)
      let store = ManagedSettingsStore()
      let effectiveApps = updatedBlocklist.applicationTokens.subtracting(currentWhitelist.applicationTokens)
      let effectiveWebDomains = updatedBlocklist.webDomainTokens.subtracting(currentWhitelist.webDomainTokens)
      let effectiveCategories = updatedBlocklist.categoryTokens.subtracting(currentWhitelist.categoryTokens)

      store.shield.applications = effectiveApps.isEmpty ? nil : effectiveApps
      store.shield.webDomains = effectiveWebDomains.isEmpty ? nil : effectiveWebDomains

      if !effectiveCategories.isEmpty {
        store.shield.applicationCategories = .specific(effectiveCategories, except: currentWhitelist.applicationTokens)
        store.shield.webDomainCategories = .specific(effectiveCategories, except: currentWhitelist.webDomainTokens)
      } else {
        store.shield.applicationCategories = nil
        store.shield.webDomainCategories = nil
      }

      ud.synchronize()
    }

    WidgetActivityKit.stopHandler = {
      // Read the selected tag from shared UserDefaults so the idle LA
      // can display the tag name and pass tagId/duration to the Start button.
      let tags = WidgetDataManager.shared.getTagList()
      let selectedTagId = WidgetDataManager.shared.getSelectedTagId()
      let tag = selectedTagId.flatMap { id in tags.first(where: { $0.id == id }) } ?? tags.first

      for activity in Activity<LiveActivityAttributes>.activities {
        let id = activity.id

        // No resolvable tag → dismiss instead of transitioning to a blank
        // "Focus" idle card (e.g. a Live Activity left over after a sign-out
        // wipe cleared the shared tag list). Mirrors the JS-side guard.
        guard let tag = tag else {
          Task {
            await activity.end(nil, dismissalPolicy: .immediate)
            print("🧹 [Widget] Dismissed blank idle LA (no resolvable tag): \(id)")
          }
          continue
        }

        Task {
          let tagTitle: String = {
            let icon = tag.icon.isEmpty ? "🎯" : tag.icon
            return "\(icon) \(tag.name)"
          }()
          let idleSubtitle: String? = {
            guard let d = tag.lastDuration else { return nil }
            return d > 0 ? "\(d) min" : "∞"
          }()
          let idleState = LiveActivityAttributes.ContentState(
            title: tagTitle,
            subtitle: idleSubtitle,
            timerEndDateInMilliseconds: nil,
            timerStartDateInMilliseconds: nil,
            progress: nil,
            imageName: "app_icon",
            dynamicIslandImageName: "app_icon",
            dynamicIslandText: tagTitle,
            isIdle: true,
            tagId: tag.id,
            durationMinutes: tag.lastDuration,
            startLabel: activity.content.state.startLabel,
            endLabel: activity.content.state.endLabel,
            unlockedLabel: activity.content.state.unlockedLabel,
            unblockExpiredLabel: activity.content.state.unblockExpiredLabel
          )
          // Update (not end) so the activity stays alive and updatable — the
          // system silently ignores updates to ended activities, so an ended
          // "idle" card could never be reloaded when the next session starts.
          // This matches the JS-side idle transition (stopFocusTimer).
          await activity.update(
            ActivityContent(state: idleState, staleDate: nil)
          )
          print("✅ [Widget] Updated Live Activity to idle: \(id)")
        }
      }
    }
  }
}
