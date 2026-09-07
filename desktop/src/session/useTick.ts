import { useEffect, useState } from 'react';

/**
 * One clock for the whole app, ticking once a second while a session runs.
 *
 * It lives at the root rather than inside the timer component because the menu
 * bar item needs the same tick, and two intervals would draw two different
 * seconds. It stops when nothing is running, so an idle app does no work.
 *
 * The window can be hidden while this ticks. macOS suspends a hidden webview's
 * timers after about five minutes, which would freeze the menu bar clock, so
 * `tauri.conf.json` sets `backgroundThrottling: "disabled"` on the window.
 */
export function useTick(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  return now;
}
