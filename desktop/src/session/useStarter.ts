import { useEffect, useState } from 'react';
import type { SessionTagCore } from 'shared/types';

/**
 * What the next session will be: which tag, and how long.
 *
 * This used to be local state inside `SessionControls`, and it moved out because
 * the menu bar item and the Cmd+Shift+B shortcut start a session with no window
 * open — they need the same choice the window shows. It persists, so a start
 * from the menu bar after a restart still uses the tag the user last picked.
 *
 * It is a preference, not synced data: it stays in this browser profile and
 * never reaches Supabase.
 */
export interface Starter {
  tagId: string;
  /** Undefined = infinite, counting up. */
  targetMinutes: number | undefined;
}

/** Presets, mirroring the phone's picker. `undefined` = infinite / count-up. */
export const DURATIONS: (number | undefined)[] = [15, 25, 30, 45, 60, undefined];

const STORAGE_KEY = 'bittersweet.starter';
const DEFAULT_TARGET_MINUTES = 25;

/** `undefined` is not JSON, so the stored form writes an absent target as null. */
interface StoredStarter {
  tagId: string;
  targetMinutes: number | null;
}

function read(): Starter {
  const fallback: Starter = { tagId: '', targetMinutes: DEFAULT_TARGET_MINUTES };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const stored = JSON.parse(raw) as StoredStarter;
    if (typeof stored?.tagId !== 'string') return fallback;
    return {
      tagId: stored.tagId,
      targetMinutes: typeof stored.targetMinutes === 'number' ? stored.targetMinutes : undefined,
    };
  } catch {
    // A corrupt or unreadable value is not worth an error path; take the default.
    return fallback;
  }
}

function write(starter: Starter): void {
  const stored: StoredStarter = {
    tagId: starter.tagId,
    targetMinutes: starter.targetMinutes ?? null,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Nothing depends on the write; a full or blocked store just forgets.
  }
}

export function useStarter(tags: SessionTagCore[]): {
  starter: Starter;
  setTagId: (tagId: string) => void;
  setTargetMinutes: (targetMinutes: number | undefined) => void;
} {
  const [starter, setStarter] = useState<Starter>(read);

  // Adopt the first tag when the stored one is gone — deleted on the phone, or
  // never chosen. Runs after the tags query lands, so it cannot pick too early.
  useEffect(() => {
    if (tags.length === 0) return;
    setStarter((current) =>
      tags.some((tag) => tag.id === current.tagId)
        ? current
        : { ...current, tagId: tags[0].id }
    );
  }, [tags]);

  useEffect(() => {
    write(starter);
  }, [starter]);

  return {
    starter,
    setTagId: (tagId) => setStarter((current) => ({ ...current, tagId })),
    setTargetMinutes: (targetMinutes) =>
      setStarter((current) => ({ ...current, targetMinutes })),
  };
}
