use tauri::{
  image::Image,
  menu::{MenuBuilder, MenuItemBuilder},
  tray::TrayIconBuilder,
  AppHandle, Manager, Runtime, WindowEvent,
};

/// The tray icon's id.
///
/// The webview finds the icon by this id and sets the title and the menu on it —
/// see `src/menubar/useTray.ts`. The icon is built here rather than there so that it
/// exists from launch, before sign-in, and so that a reload of the page cannot
/// leave a second one behind.
const TRAY_ID: &str = "main";

/// A monochrome template PNG. macOS throws its colour away and re-tints the
/// alpha channel, so one file is correct in a light and in a dark menu bar.
/// Redraw it with `scripts/make-tray-icon.py`.
const TRAY_ICON: &[u8] = include_bytes!("../icons/tray.png");

/// The label of the window in `tauri.conf.json`. Tauri assigns "main" by default.
const MAIN_WINDOW: &str = "main";

/// Bring the window back and give it the keyboard.
fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
  if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // Single instance must be registered before every other plugin, as its
    // own documentation says. A second copy would otherwise get far enough
    // to add a second menu bar item and a second timer.
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      show_main_window(app);
    }))
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_oauth::init())
    .plugin(
      // Everything except VISIBLE. The plugin's default tracks that too, and it
      // would restore a window the user last hid — so a launch from Finder would
      // put an icon in the menu bar and nothing on screen, and read as a failure
      // to start. Size and position are what the user actually wants back.
      tauri_plugin_window_state::Builder::default()
        .with_state_flags(
          tauri_plugin_window_state::StateFlags::all()
            - tauri_plugin_window_state::StateFlags::VISIBLE,
        )
        .build(),
    )
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .plugin(tauri_plugin_autostart::init(
      tauri_plugin_autostart::MacosLauncher::LaunchAgent,
      None,
    ))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // A menu bar app: no Dock icon, and no entry in Cmd+Tab. The menu bar
      // item is the way in, and Quit lives in its menu.
      //
      // The cost of the accessory policy is that macOS draws no menu bar for
      // the app, so the app menu's key equivalents — Cmd+C, Cmd+V, Cmd+Q —
      // are not guaranteed. See the README.
      #[cfg(target_os = "macos")]
      app.set_activation_policy(tauri::ActivationPolicy::Accessory);

      // A menu that works before the webview has loaded, and still works if it
      // never does. With no Dock icon and no app menu, a tray with no Quit item
      // would leave Force Quit as the only way out of a broken launch.
      // `useTray.ts` replaces this whole menu once React mounts.
      //
      // The ids carry a prefix because `on_menu_event` below registers a
      // *global* listener, not one scoped to this menu — it is offered every
      // menu event in the app, the webview's own items included. The prefix is
      // what keeps it from acting on them twice.
      let open = MenuItemBuilder::with_id("fallback-open", "Open Bittersweet").build(app)?;
      let quit = MenuItemBuilder::with_id("fallback-quit", "Quit Bittersweet").build(app)?;
      let fallback = MenuBuilder::new(app)
        .items(&[&open])
        .separator()
        .items(&[&quit])
        .build()?;

      TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(TRAY_ICON)?)
        .icon_as_template(true)
        .tooltip("Bittersweet")
        .menu(&fallback)
        .on_menu_event(|app, event| match event.id().as_ref() {
          "fallback-open" => show_main_window(app),
          "fallback-quit" => app.exit(0),
          _ => {}
        })
        .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| {
      if let WindowEvent::CloseRequested { api, .. } = event {
        // The timer runs in the webview, and closing the window destroys
        // it. Hide the window instead, so the menu bar keeps counting.
        // `backgroundThrottling: "disabled"` in tauri.conf.json is what
        // keeps the hidden webview's interval ticking every second.
        api.prevent_close();
        let _ = window.hide();
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
