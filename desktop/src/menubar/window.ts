import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * The window, from the menu bar item's point of view.
 *
 * Closing the window does not quit the app any more — Rust turns the close into
 * a hide (`src-tauri/src/lib.rs`) so the timer keeps running. That makes showing
 * the window again something several places need.
 */

/** Bring the window up and give it the keyboard. */
export async function showWindow(): Promise<void> {
  const window = getCurrentWindow();
  await window.show();
  await window.unminimize();
  await window.setFocus();
}

/**
 * Show the window, or hide it when it is already in front.
 *
 * A window that is visible but behind another app must come forward, not
 * disappear — pressing the shortcut there means "let me see it".
 */
export async function toggleWindow(): Promise<void> {
  const window = getCurrentWindow();
  if ((await window.isVisible()) && (await window.isFocused())) {
    await window.hide();
    return;
  }
  await showWindow();
}
