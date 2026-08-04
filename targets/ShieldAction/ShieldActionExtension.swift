//
//  ShieldActionExtension.swift
//  ShieldAction
//
//  Created by Robert Herber on 2024-10-25.
//

import FamilyControls
import ManagedSettings
import UIKit
import UserNotifications
import os

/// Writes communication data to UserDefaults for main app to read
func writeShieldCommunicationToUserDefaults(
  actionType: String,
  bundleId: String?,
  shieldId: String?
) {
  let communicationData: [String: Any] = [
    "action": actionType,
    "bundleId": bundleId ?? "unknown",
    "shieldId": shieldId ?? "unknown",
    "timestamp": Date().timeIntervalSince1970,
    "source": "shieldExtension"
  ]

  userDefaults?.set(communicationData, forKey: "pendingMainAppAction")
  logger.log("📡 Written shield communication data to UserDefaults: \(communicationData, privacy: .public)")
}

func handleShieldAction(
  configForSelectedAction: [String: Any],
  placeholders: [String: String?],
  applicationToken: ApplicationToken?,
  webdomainToken: WebDomainToken?,
  categoryToken: ActivityCategoryToken?,
  actionButton: String? = nil
) -> ShieldActionResponse {
  let configKeys = Array(configForSelectedAction.keys).joined(separator: ", ")
  logger.log("🚨🚨🚨 ENTERING handleShieldAction FUNCTION 🚨🚨🚨")
  logger.log("🔥 handleAction START - config keys: \(configKeys, privacy: .public)")

  // Log the full config (be careful with sensitive data)
  if let configData = try? JSONSerialization.data(withJSONObject: configForSelectedAction),
     let configString = String(data: configData, encoding: .utf8) {
    logger.log("📋 Full config: \(configString, privacy: .public)")
  }

  let behavior = configForSelectedAction["behavior"] as? String ?? "close"

  // iOS 26.5 added ShieldActionResponse.openParentalControlsApp — the first
  // supported way for a shield to open the app that applied it. Below 26.5 there
  // is none, so the config also carries fallback actions (a tappable
  // notification) which we run only when we can't open the app directly.
  var opensParentalControlsApp = false
  if behavior == "openParentalControlsApp", #available(iOS 26.5, *) {
    opensParentalControlsApp = true
  }

  if let actions = configForSelectedAction["actions"] as? [[String: Any]] {
    let actionCount = actions.count
    logger.log("🎯 Found \(actionCount) actions to execute")

    // Recorded either way: the main app reads this on next foreground to know it
    // was opened from the shield and resume the unlock flow.
    writeShieldCommunicationToUserDefaults(
      actionType: "\(actionButton ?? "unknown")ButtonTapped",
      bundleId: nil,
      shieldId: configForSelectedAction["shieldId"] as? String
    )

    for (index, action) in actions.enumerated() {
      let actionNumber = index + 1

      if opensParentalControlsApp, action["isOpenAppFallback"] as? Bool == true {
        logger.log("⏭️ Skipping open-app fallback action \(actionNumber)/\(actionCount)")
        continue
      }

      logger.log("▶️ Executing action \(actionNumber)/\(actionCount)")

      executeGenericAction(
        action: action,
        placeholders: placeholders,
        triggeredBy: "shieldAction",
        applicationToken: applicationToken,
        webdomainToken: webdomainToken,
        categoryToken: categoryToken
      )

      logger.log("✅ Completed action \(actionNumber)")
    }
  } else {
    logger.log("❌ No actions array found in config")
  }

  if let type = configForSelectedAction["type"] as? String {
    logger.log("🔧 Processing deprecated type: \(type, privacy: .public)")
    if type == "disableBlockAllMode" {
      disableBlockAllMode(triggeredBy: "shieldAction")
    }

    let onlyFamilySelectionIdsContainingMonitoredActivityNames =
      configForSelectedAction["onlyFamilySelectionIdsContainingMonitoredActivityNames"] as? Bool
      ?? true

    let sortByGranularity = true

    if type == "unblockPossibleFamilyActivitySelection" {
      if let possibleFamilyActivitySelectionId = getPossibleFamilyActivitySelectionIds(
        applicationToken: applicationToken,
        webDomainToken: webdomainToken,
        categoryToken: categoryToken,
        onlyFamilySelectionIdsContainingMonitoredActivityNames:
          onlyFamilySelectionIdsContainingMonitoredActivityNames,
        sortByGranularity: sortByGranularity
      ).first?.id {
        if let selection = getFamilyActivitySelectionById(id: possibleFamilyActivitySelectionId) {
          unblockSelection(removeSelection: selection, triggeredBy: "shieldAction")
        }
      }
    }

    if type == "unblockAllPossibleFamilyActivitySelections" {
      let possibleFamilyActivitySelections = getPossibleFamilyActivitySelectionIds(
        applicationToken: applicationToken,
        webDomainToken: webdomainToken,
        categoryToken: categoryToken,
        onlyFamilySelectionIdsContainingMonitoredActivityNames:
          onlyFamilySelectionIdsContainingMonitoredActivityNames,
        sortByGranularity: sortByGranularity
      )

      for selection in possibleFamilyActivitySelections {
        unblockSelection(
          removeSelection: selection.selection,
          triggeredBy: "shieldAction"
        )
      }
    }

    if type == "whitelistPossibleFamilyActivitySelection" {
      if let possibleFamilyActivitySelectionId = getPossibleFamilyActivitySelectionIds(
        applicationToken: applicationToken,
        webDomainToken: webdomainToken,
        categoryToken: categoryToken,
        onlyFamilySelectionIdsContainingMonitoredActivityNames:
          onlyFamilySelectionIdsContainingMonitoredActivityNames,
        sortByGranularity: sortByGranularity
      ).first?.id {
        if let selection = getFamilyActivitySelectionById(id: possibleFamilyActivitySelectionId) {
          addSelectionToWhitelistAndUpdateBlock(
            whitelistSelection: selection,
            triggeredBy: "shieldAction"
          )
        }
      }
    }

    if type == "whitelistAllPossibleFamilyActivitySelections" {
      let possibleFamilyActivitySelections = getPossibleFamilyActivitySelectionIds(
        applicationToken: applicationToken,
        webDomainToken: webdomainToken,
        categoryToken: categoryToken,
        onlyFamilySelectionIdsContainingMonitoredActivityNames:
          onlyFamilySelectionIdsContainingMonitoredActivityNames,
        sortByGranularity: sortByGranularity
      )

      for selection in possibleFamilyActivitySelections {
        addSelectionToWhitelistAndUpdateBlock(
          whitelistSelection: selection.selection,
          triggeredBy: "shieldAction"
        )
      }
    }

    if type == "resetBlocks" {
      resetBlocks(triggeredBy: "shieldAction")
    }

    if type == "sendNotification" {
      logger.log("🔔 Executing sendNotification")
      if let payload = configForSelectedAction["payload"] as? [String: Any] {
        logger.log("📩 Notification payload found")
        sendNotification(contents: payload, placeholders: [:])
        logger.log("✅ sendNotification completed")
      } else {
        logger.log("❌ No payload found for sendNotification")
      }
    }

    if type == "addCurrentToWhitelist" {
      var selection = getCurrentWhitelist()

      if let applicationToken = applicationToken {
        selection.applicationTokens.insert(applicationToken)
      }

      if let webdomainToken = webdomainToken {
        selection.webDomainTokens.insert(webdomainToken)
      }

      if let categoryToken = categoryToken {
        selection.categoryTokens.insert(categoryToken)
      }

      saveCurrentWhitelist(whitelist: selection)
      updateBlock(triggeredBy: "shieldAction")
    }
  }

  CFPreferencesAppSynchronize(kCFPreferencesCurrentApplication)

  logger.log("🏁 Shield action completed, returning behavior: \(behavior, privacy: .public)")

  if opensParentalControlsApp, #available(iOS 26.5, *) {
    return .openParentalControlsApp
  }

  if behavior == "defer" {
    return .defer
  }

  return .close
}

func handleAction(
  action: ShieldAction,
  completionHandler: @escaping (ShieldActionResponse) -> Void,
  applicationToken: ApplicationToken?,
  webdomainToken: WebDomainToken?,
  categoryToken: ActivityCategoryToken?
) {
  logger.log("🚀 HandleAction START")
  CFPreferencesAppSynchronize(kCFPreferencesCurrentApplication)
  logger.log("🔄 Preferences synchronized")

  if let shieldActionConfig = getActivitySelectionPrefixedConfigFromUserDefaults(
    keyPrefix: SHIELD_ACTIONS_FOR_SELECTION_PREFIX,
    fallbackKey: SHIELD_ACTIONS_KEY,
    applicationToken: applicationToken,
    webDomainToken: webdomainToken,
    categoryToken: categoryToken
  ) {
    logger.log("✅ Found shield action config!")
    let configKeys = Array(shieldActionConfig.keys).joined(separator: ", ")
    logger.log("🔧 Config keys: \(configKeys, privacy: .public)")
    let actionButton = action == .primaryButtonPressed ? "primary" : "secondary"
    let familyActivitySelectionId = getPossibleFamilyActivitySelectionIds(
      applicationToken: applicationToken,
      webDomainToken: webdomainToken,
      categoryToken: categoryToken,
      onlyFamilySelectionIdsContainingMonitoredActivityNames: true,
      sortByGranularity: true
    ).first
    if let configForSelectedAction = shieldActionConfig[actionButton] as? [String: Any] {
      let placeholders: [String: String?] = [
        "action": actionButton,
        "applicationName": applicationToken != nil
          ? Application(token: applicationToken!).localizedDisplayName : nil,
        "webDomain": webdomainToken != nil
          ? WebDomain(
            token: webdomainToken!
          ).domain : nil,
        "familyActivitySelectionId": familyActivitySelectionId?.id
      ]

      let response = handleShieldAction(
        configForSelectedAction: configForSelectedAction,
        placeholders: placeholders,
        applicationToken: applicationToken,
        webdomainToken: webdomainToken,
        categoryToken: categoryToken,
        actionButton: actionButton
      )
      if let delay = configForSelectedAction["delay"] as? Double {
        DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
          completionHandler(response)
        }
      } else {
        completionHandler(response)
      }
    } else {
      logger.log("❌ No action config found for button: \(actionButton, privacy: .public)")
      completionHandler(.close)
    }
  } else {
    logger.log("❌ No shield action config found at all!")
    logger.log("🔍 Checked keys: \(SHIELD_ACTIONS_FOR_SELECTION_PREFIX, privacy: .public) and \(SHIELD_ACTIONS_KEY, privacy: .public)")
    completionHandler(.close)
  }
}

// Override the functions below to customize the shield actions used in various situations.
// The system provides a default response for any functions that your subclass doesn't override.
// Make sure that your class name matches the NSExtensionPrincipalClass in your Info.plist.
class ShieldActionExtension: ShieldActionDelegate {
  override func handle(
    action: ShieldAction, for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    logger.log("🍎 Handle Application - action received")
    logger.log("🍎 Application token received")
    logger.log("🔍 Action type: \(action == .primaryButtonPressed ? "primary" : "secondary", privacy: .public)")

    // Log if we have any shield actions configured
    let fallbackConfig = userDefaults?.dictionary(forKey: SHIELD_ACTIONS_KEY)
    let hasFallbackConfig = fallbackConfig != nil
    logger.log("📋 Has fallback shield actions config: \(hasFallbackConfig, privacy: .public)")

    if let config = fallbackConfig {
      let configKeys = Array(config.keys).joined(separator: ", ")
      logger.log("📋 Fallback config keys: \(configKeys, privacy: .public)")
    }

    // Action parameter is just an enum (.primaryButtonPressed or .secondaryButtonPressed)
    // The actual configuration is retrieved in handleAction() from UserDefaults

    logger.log("🔄 About to call handleAction")
    handleAction(
      action: action,
      completionHandler: { response in
        let responseStr = String(describing: response)
        logger.log("🍎 Application action completed with response: \(responseStr, privacy: .public)")
        completionHandler(response)
      },
      applicationToken: application,
      webdomainToken: nil,
      categoryToken: nil
    )
  }

  override func handle(
    action: ShieldAction, for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    logger.log("🌐 Handle Web Domain - action received")
    logger.log("🌐 Web domain token received")

    handleAction(
      action: action,
      completionHandler: completionHandler,
      applicationToken: nil,
      webdomainToken: webDomain,
      categoryToken: nil
    )
  }

  override func handle(
    action: ShieldAction, for category: ActivityCategoryToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    logger.log("handle category")

    handleAction(
      action: action,
      completionHandler: completionHandler,
      applicationToken: nil,
      webdomainToken: nil,
      categoryToken: category
    )
  }
}
