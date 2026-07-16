import { useState, useEffect, useRef, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { GroveService } from '../services/grove';
import { isDeviceOffline } from '../utils/network';

export type HandleStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'offline';

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
        // Offline: surface it and block the step. Other failures (server hiccup
        // while online) stay optimistic - the DB unique constraint is the safety net.
        const offline = await isDeviceOffline();
        if (currentAbort.current) return;
        setStatus(offline ? 'offline' : 'available');
      }
    }, DEBOUNCE_MS);
  }, []);

  // If the availability check failed offline, re-run it automatically when
  // connectivity returns so the user isn't stuck until they retype the handle.
  const statusRef = useRef<HandleStatus>('idle');
  statusRef.current = status;
  const handleValueRef = useRef('');
  handleValueRef.current = handle;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && statusRef.current === 'offline') {
        validateHandle(handleValueRef.current);
      }
    });
    return unsubscribe;
  }, [validateHandle]);

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
