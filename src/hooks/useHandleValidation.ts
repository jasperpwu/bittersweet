import { useState, useEffect, useRef, useCallback } from 'react';
import { GroveService } from '../services/grove';

export type HandleStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const HANDLE_REGEX = /^[a-z0-9_]{3,20}$/;
const DEBOUNCE_MS = 500;

export function useHandleValidation() {
  const [handle, setHandle] = useState('');
  const [status, setStatus] = useState<HandleStatus>('idle');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef(false);

  const validateHandle = useCallback((value: string) => {
    // Clear any pending timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    abortRef.current = true;

    // Normalize: lowercase, strip leading @
    const normalized = value.toLowerCase().replace(/^@/, '');
    setHandle(normalized);

    if (!normalized) {
      setStatus('idle');
      return;
    }

    if (!HANDLE_REGEX.test(normalized)) {
      setStatus('invalid');
      return;
    }

    // Valid format - debounce the availability check
    setStatus('checking');
    abortRef.current = false;
    const currentAbort = abortRef;

    timerRef.current = setTimeout(async () => {
      try {
        const available = await GroveService.checkHandleAvailable(normalized);
        if (currentAbort.current) return;
        setStatus(available ? 'available' : 'taken');
      } catch {
        if (currentAbort.current) return;
        // On network error, don't block the user - show as available
        // DB unique constraint is the safety net
        setStatus('available');
      }
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      abortRef.current = true;
    };
  }, []);

  return {
    handle,
    status,
    setHandle: validateHandle,
    isValid: status === 'available',
  };
}
