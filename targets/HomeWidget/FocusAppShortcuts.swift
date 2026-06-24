import AppIntents

// Registers the focus Start/Stop intents with Siri and Spotlight as App Shortcuts.
//
// IMPORTANT: This file is compiled into the MAIN APP target ONLY (registered in
// plugins/withHomeWidget.js -> mainAppFiles, NOT widgetExtensionFiles). An app may
// expose exactly one AppShortcutsProvider; compiling it into the widget extension
// too would double-register the shortcuts.
//
// App Shortcuts constraints reflected below:
//   - Every phrase must contain \(.applicationName).
//   - A single phrase may contain at most ONE parameter token. So the tag is the
//     spoken parameter; duration is not spoken in the same breath — it defaults to
//     the tag's last-used duration and is editable in the Shortcuts app via
//     StartSessionIntent.parameterSummary.
@available(iOS 17.0, *)
struct BittersweetAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    // Siri matches the spoken utterance against these phrases fairly literally (it is
    // phrase-matching, not free-form understanding), so we enumerate the natural
    // variations: with/without "a" before the tag, with/without "focus" before
    // "session", and with/without a trailing "app". Every phrase must contain the
    // app name token, and the tag is the single parameter.
    AppShortcut(
      intent: StartSessionIntent(),
      phrases: [
        "Start a \(\.$tag) session in \(.applicationName)",
        "Start \(\.$tag) session in \(.applicationName)",
        "Start a \(\.$tag) focus session in \(.applicationName)",
        "Start \(\.$tag) focus session in \(.applicationName)",
        "Start a \(\.$tag) session in \(.applicationName) app",
        "Start \(\.$tag) session in \(.applicationName) app",
        "Start a \(\.$tag) focus session in \(.applicationName) app",
        "Start \(\.$tag) focus session in \(.applicationName) app",
        "Start a \(\.$tag) session with \(.applicationName)",
        "Begin a \(\.$tag) session in \(.applicationName)",
        "Begin \(\.$tag) session in \(.applicationName)",
        "Start \(\.$tag) focus in \(.applicationName)",
        "Start \(\.$tag) in \(.applicationName)",
      ],
      shortTitle: "Start Focus",
      systemImageName: "timer"
    )
    AppShortcut(
      intent: StopSessionIntent(),
      phrases: [
        "Stop my focus session in \(.applicationName)",
        "Stop my session in \(.applicationName)",
        "Stop focus session in \(.applicationName)",
        "Stop session in \(.applicationName)",
        "Stop focusing in \(.applicationName)",
        "Stop my focus session in \(.applicationName) app",
        "Stop focusing in \(.applicationName) app",
        "End focusing in \(.applicationName)",
        "End my focus session in \(.applicationName)",
        "End session in \(.applicationName)",
        "End my session in \(.applicationName)",
      ],
      shortTitle: "Stop Focus",
      systemImageName: "stop.circle"
    )
  }
}
