Top suggestion: a menu-bar timer with a global shortcut. Everything else is second to that.

Ranked

1. Menu bar + global shortcut — the desktop app today needs an open window. A phone timer does not. Tauri gives a tray icon (features = ["tray-icon"]) with a macOS title, so the remaining time sits in the menu bar, and a shortcut starts or stops without a window. Add tauri-plugin-global-shortcut, -autostart, -window-state, -single-instance. No schema change, no iOS change.

2. Todos → start a session on a task. The todos table already syncs, and iOS already starts sessions from journal TODOs (Phase 2 reuses that machinery). A laptop is where the user plans work, so the list belongs here. Cost: one query, one hook, reuse of start_active_session.

3. Notes and retag on a finished session. A keyboard beats a phone for text. notes and tag_id are already in the shared/ wire format, and both are inputs, not derived values — so this respects the "never write anything derived" rule.

4. Insights, read-only. focus_sessions is already in the client, and coach_reports holds the weekly AI narration as plain text. The phone tab is cramped; a laptop is not. Charts and the report cost no new table and no write path.

5. Remote shield control. Phase 4 already moves the shield with the app closed, and session-remote-control already exists. A "block now" button from the laptop is a small addition on top. Careful: the edit cost and the weekly escalation live on iOS, so the desktop must trigger, not compute.

Small wins, an hour each: a native notification when a session ends, and a hold on display sleep during a session.

Keep on iOS

- Grove — social, photo-heavy, and the moderation surface (block/report) is a review requirement.
- Fruit store and subscriptions — StoreKit is device-local.
- The blocklist app picker — Family Controls has no macOS equivalent.
- Anything derived — fruits, badges, streaks and ratings stay in one implementation.

If you want, I can start with 1, because it changes how the app feels more than the rest combined. No code changed this turn.