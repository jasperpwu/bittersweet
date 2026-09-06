import { AppState } from 'react-native';

/**
 * whenAppActive — run a task only while the app is frontmost.
 *
 * iOS launches this app in the background for reasons the user never sees: an
 * ActivityKit push-to-start wake, a widget push-token rotation, a remote
 * notification. React still mounts and our effects still run, so an unguarded
 * permission request fires with no app on screen. The system alert (Screen
 * Time, Motion & Fitness, notifications, HealthKit) then lands on top of
 * whatever the user is really doing, or queues and appears later with no
 * context.
 *
 * Wrap every prompt the *app* starts (not the ones a user tap starts) in this
 * helper. When the app is active the task runs immediately. When it is not, the
 * task waits for the next transition to `active`.
 *
 * Tasks are keyed and drained one after the other, so a repeated schedule of the
 * same key replaces the earlier one, and two prompts never stack.
 */

/** True while the app is frontmost. */
export function isAppActive(): boolean {
  return AppState.currentState === 'active';
}

/** Any thunk; the return value is ignored, a promise is awaited. */
type Task = () => unknown;

const deferred = new Map<string, Task>();
let subscription: { remove: () => void } | null = null;
let draining = false;

function unsubscribeIfIdle(): void {
  if (deferred.size === 0 && subscription) {
    subscription.remove();
    subscription = null;
  }
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    // Sequential on purpose: two system alerts must never compete for the screen.
    while (deferred.size > 0 && isAppActive()) {
      const [key, task] = deferred.entries().next().value as [string, Task];
      deferred.delete(key);
      try {
        await task();
      } catch (error) {
        console.warn(`[whenAppActive] deferred task "${key}" failed:`, error);
      }
    }
  } finally {
    draining = false;
    unsubscribeIfIdle();
  }
}

/**
 * Run `task` now if the app is active, or on the next foreground if it is not.
 *
 * @param key Identity of the task. A later schedule with the same key replaces
 *   the pending one, so a background wake loop cannot queue duplicate prompts.
 */
export function whenAppActive(key: string, task: Task): void {
  if (isAppActive()) {
    void Promise.resolve()
      .then(task)
      .catch((error) => console.warn(`[whenAppActive] task "${key}" failed:`, error));
    return;
  }

  deferred.set(key, task);
  if (!subscription) {
    subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void drain();
    });
  }
}
