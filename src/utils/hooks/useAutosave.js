import { useRef, useEffect, useState, useCallback } from "react";

/**
 * Debounced autosave hook. Calls `saver(value)` after `delay` ms of quiet
 * whenever `value` changes, but only once `enabled` is true.
 *
 * @param {*} value - The current value to watch and persist.
 * @param {(value: *) => Promise} saver - Async function that persists the value.
 * @param {number} [delay=800] - Debounce delay in milliseconds.
 * @param {boolean} [enabled=true] - Master switch; when false, no saves fire.
 * @returns {{isDirty: boolean, flush: () => Promise<void>}}
 */
export const useAutosave = (value, saver, delay = 800, enabled = true) => {
  const [isDirty, setIsDirty] = useState(false);
  const timeoutRef = useRef(null);
  const lastSavedRef = useRef(value);
  const saverRef = useRef(saver);
  const wasEnabledRef = useRef(false);

  // Keep saver ref current without retriggering the effect
  useEffect(() => {
    saverRef.current = saver;
  }, [saver]);

  useEffect(() => {
    // When autosave first becomes enabled, treat current value as the baseline
    if (enabled && !wasEnabledRef.current) {
      wasEnabledRef.current = true;
      lastSavedRef.current = value;
      return;
    }

    if (!enabled) {
      wasEnabledRef.current = false;
      return;
    }

    // No change from last saved baseline
    if (value === lastSavedRef.current) return;

    setIsDirty(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      try {
        await saverRef.current(value);
        lastSavedRef.current = value;
      } catch (e) {
        console.error("Autosave failed:", e);
      } finally {
        setIsDirty(false);
        timeoutRef.current = null;
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [value, delay, enabled]);

  // Manually flush pending changes (for navigation guards)
  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (value !== lastSavedRef.current) {
      try {
        await saverRef.current(value);
        lastSavedRef.current = value;
      } catch (e) {
        console.error("Autosave flush failed:", e);
      } finally {
        setIsDirty(false);
      }
    }
  }, [value]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { isDirty, flush };
};
