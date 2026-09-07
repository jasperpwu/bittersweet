import { useEffect, useState } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';

/**
 * "Launch at login", as a macOS LaunchAgent.
 *
 * It earns its place now that the app lives in the menu bar: a timer nobody
 * opened a window for is only there if the app started on its own. The plugin
 * writes the plist, so there is no state of ours to persist.
 */
export function LaunchAtLogin() {
  // Null while the plist is being read — the checkbox must not claim "off"
  // before the answer arrives.
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let alive = true;
    void isEnabled()
      .then((value) => alive && setOn(value))
      .catch(() => alive && setOn(false));
    return () => {
      alive = false;
    };
  }, []);

  // In the browser there is nothing to launch, so the row is not shown at all.
  if (!isTauri() || on == null) return null;

  const toggle = async (next: boolean) => {
    setError(null);
    // Move the checkbox first; the plist write is fast but not instant.
    setOn(next);
    try {
      await (next ? enable() : disable());
    } catch (e) {
      setOn(!next);
      setError(e instanceof Error ? e.message : 'Could not change launch at login.');
    }
  };

  return (
    <div className="setting">
      <label className="setting-row">
        <input type="checkbox" checked={on} onChange={(e) => void toggle(e.target.checked)} />
        <span>Launch at login</span>
      </label>
      <p className="muted">
        Bittersweet lives in the menu bar. Closing the window keeps the timer running; quit
        from the menu bar icon.
      </p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
