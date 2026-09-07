import { useEffect, useRef } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { Menu, type MenuOptions } from '@tauri-apps/api/menu';
import { TrayIcon } from '@tauri-apps/api/tray';
import type { ActiveSessionCore, SessionTagCore } from 'shared/types';
import { formatClock, readClock } from '../session/clock';
import type { Starter } from '../session/useStarter';
import { TOGGLE_SESSION_SHORTCUT, TOGGLE_WINDOW_SHORTCUT } from './shortcuts';
import { showWindow } from './window';

/**
 * The menu bar item.
 *
 * Rust builds the icon at launch (`src-tauri/src/lib.rs`) and this file gives it
 * a title and a menu, because the session data lives here. The split matters: an
 * icon built here would appear only after sign-in, and a webview reload would
 * leave a second one behind.
 */

/** Must match `TRAY_ID` in `src-tauri/src/lib.rs`. */
const TRAY_ID = 'main';

/**
 * `getById` returns a fresh handle onto the same icon every call, so it is
 * memoised. Never call `close()` on it — that would remove the icon itself.
 */
let iconHandle: Promise<TrayIcon | null> | undefined;

function menuBarItem(): Promise<TrayIcon | null> {
  iconHandle ??= TrayIcon.getById(TRAY_ID);
  return iconHandle;
}

function tagLabel(tag: SessionTagCore | undefined): string {
  return tag ? `${tag.icon} ${tag.name}` : 'Focus';
}

function targetLabel(targetMinutes: number | undefined): string {
  return targetMinutes == null ? 'no limit' : `${targetMinutes}m`;
}

/**
 * What the menu bar reads: the tag, then the time.
 *
 * A session with a target counts down, and past the target it counts up from
 * zero behind a plus sign. There is no room for a phrase like "over time" in a
 * menu bar, so the sign carries it.
 */
function trayTitle(
  active: ActiveSessionCore | null,
  tags: SessionTagCore[],
  now: number
): string | null {
  if (!active) return null;
  const { elapsed, remaining } = readClock(active, now);
  const clock =
    remaining == null
      ? formatClock(elapsed)
      : remaining > 0
        ? formatClock(remaining)
        : `+${formatClock(-remaining)}`;
  return `${tagLabel(tags.find((tag) => tag.id === active.tagId))} ${clock}`;
}

/**
 * Replace the icon's menu, and free the one it held.
 *
 * A `Menu` is a handle onto a resource in Rust, so an old menu that nothing
 * closes leaks — and the menu is rebuilt on every start, stop and tag change.
 * The whole tree is one resource, because the items are passed as plain objects:
 * `Menu.new` then builds them in Rust in a single call. Constructing a
 * `Submenu` or a `PredefinedMenuItem` here instead would make each one a
 * separate resource with nothing to close it.
 *
 * A build is an IPC round trip, so a slow one can finish after a newer one. The
 * counter makes sure only the newest reaches the icon; an overtaken menu is
 * closed rather than shown.
 */
let currentMenu: Menu | undefined;
let generation = 0;

async function applyMenu(options: MenuOptions): Promise<void> {
  const mine = ++generation;
  const menu = await Menu.new(options);
  const tray = await menuBarItem();

  if (mine !== generation || !tray) {
    await menu.close();
    return;
  }

  await tray.setMenu(menu);
  const previous = currentMenu;
  currentMenu = menu;
  await previous?.close();
}

export function useTray(params: {
  signedIn: boolean;
  tags: SessionTagCore[];
  active: ActiveSessionCore | null;
  running: boolean;
  starter: Starter;
  now: number;
  onStart: (tagId: string, targetMinutes: number | undefined) => void;
  onStop: () => void;
}): void {
  const { signedIn, tags, active, running, starter, now, onStart, onStop } = params;

  // The menu is rebuilt only when its text changes, so its click handlers read
  // the callbacks through a ref rather than holding the ones captured that time.
  const callbacks = useRef({ onStart, onStop });
  callbacks.current = { onStart, onStop };

  // --- The title, once a second while a session runs. ---
  const lastTitle = useRef<string | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    const title = running ? trayTitle(active, tags, now) : null;
    if (title === lastTitle.current) return;
    lastTitle.current = title;
    void menuBarItem().then((tray) => tray?.setTitle(title));
  }, [active, running, tags, now]);

  // --- The menu, whenever one of its lines would read differently. ---
  const starterTag = tags.find((tag) => tag.id === starter.tagId);
  const activeTag = active ? tags.find((tag) => tag.id === active.tagId) : undefined;
  const signature = [
    signedIn,
    running,
    running ? tagLabel(activeTag) : tagLabel(starterTag),
    starter.tagId,
    targetLabel(starter.targetMinutes),
    tags.map((tag) => `${tag.id}${tag.icon}${tag.name}`).join(' '),
  ].join('|');

  useEffect(() => {
    if (!isTauri()) return;
    void applyMenu(
      menuOptions({
        signedIn,
        running,
        tags,
        starter,
        activeTag,
        starterTag,
        onStart: (tagId, targetMinutes) => callbacks.current.onStart(tagId, targetMinutes),
        onStop: () => callbacks.current.onStop(),
      })
    );
    // Everything the menu reads is folded into the signature, deliberately: the
    // dependency is the *text* of the menu, not the objects behind it.
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
}

function menuOptions(params: {
  signedIn: boolean;
  running: boolean;
  tags: SessionTagCore[];
  starter: Starter;
  activeTag: SessionTagCore | undefined;
  starterTag: SessionTagCore | undefined;
  onStart: (tagId: string, targetMinutes: number | undefined) => void;
  onStop: () => void;
}): MenuOptions {
  const { signedIn, running, tags, starter, activeTag, starterTag, onStart, onStop } =
    params;

  const items: NonNullable<MenuOptions['items']> = [];

  if (signedIn) {
    if (running) {
      items.push({
        id: 'stop',
        text: `Stop ${tagLabel(activeTag)}`,
        accelerator: TOGGLE_SESSION_SHORTCUT,
        action: () => onStop(),
      });
    } else {
      items.push({
        id: 'start',
        text: starterTag
          ? `Start ${tagLabel(starterTag)} · ${targetLabel(starter.targetMinutes)}`
          : 'Start',
        enabled: starterTag != null,
        accelerator: TOGGLE_SESSION_SHORTCUT,
        action: () => onStart(starter.tagId, starter.targetMinutes),
      });

      // Only worth a submenu when there is another tag to pick.
      if (tags.length > 1) {
        items.push({
          text: 'Start with…',
          items: tags.map((tag) => ({
            id: `start-${tag.id}`,
            text: tagLabel(tag),
            action: () => onStart(tag.id, starter.targetMinutes),
          })),
        });
      }
    }
    items.push({ item: 'Separator' });
  }

  items.push({
    id: 'open',
    text: 'Open Bittersweet',
    accelerator: TOGGLE_WINDOW_SHORTCUT,
    action: () => void showWindow(),
  });
  items.push({ item: 'Separator' });
  items.push({ item: 'Quit', text: 'Quit Bittersweet' });

  return { items };
}
