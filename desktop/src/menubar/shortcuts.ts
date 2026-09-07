import { useEffect, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { toggleWindow } from './window';

/**
 * The two system-wide keys.
 *
 * The same strings label the tray menu items, so the menu can never advertise a
 * key that is not the one registered. Tauri's accelerator parser and the tray
 * menu's parser both read this form, and both ignore case.
 */
export const TOGGLE_SESSION_SHORTCUT = 'CommandOrControl+Shift+B';
export const TOGGLE_WINDOW_SHORTCUT = 'CommandOrControl+Shift+M';

const SHORTCUTS = [TOGGLE_SESSION_SHORTCUT, TOGGLE_WINDOW_SHORTCUT];

/**
 * Registration is global to the OS, so it must be serialised.
 *
 * React mounts an effect twice in development, and a reload leaves the previous
 * registration in place. Both give two overlapping async runs, and `register`
 * rejects a shortcut that is already registered. Chaining every call means the
 * last one always decides the final state.
 */
let queue: Promise<unknown> = Promise.resolve();

function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task, task).catch((error: unknown) => {
    console.warn('[Shortcuts]', error);
  });
}

/**
 * Start or stop a session, and show or hide the window, from anywhere on the
 * machine. macOS registers these through Carbon, so they need no Accessibility
 * permission.
 */
export function useGlobalShortcuts(onToggleSession: () => void): void {
  // The handler is registered once and must see the current session, so it reads
  // the callback through a ref instead of being re-registered on every change.
  const toggleSession = useRef(onToggleSession);
  toggleSession.current = onToggleSession;

  useEffect(() => {
    if (!isTauri()) return;

    enqueue(async () => {
      // Clear whatever a previous run left behind; the first run has nothing to
      // clear, and unregistering an unknown shortcut is an error there.
      await unregister(SHORTCUTS).catch(() => undefined);
      await register(SHORTCUTS, (event) => {
        // The handler also fires on key up. Acting on both would toggle twice.
        if (event.state !== 'Pressed') return;
        if (event.shortcut === TOGGLE_SESSION_SHORTCUT) toggleSession.current();
        else void toggleWindow();
      });
    });

    return () => {
      enqueue(() => unregister(SHORTCUTS).catch(() => undefined));
    };
  }, []);
}
