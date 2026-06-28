import { useState, useCallback, useRef } from "react";

// Replaces Chakra v2's useClipboard (removed in v3). Returns { onCopy, hasCopied }.
// `text` may be a string or a () => string. `hasCopied` resets after `timeout` ms.
export function useClipboard(text, { timeout = 1500 } = {}) {
  const [hasCopied, setHasCopied] = useState(false);
  const timerRef = useRef(null);

  const onCopy = useCallback(() => {
    const value = typeof text === "function" ? text() : text;
    try {
      navigator.clipboard?.writeText(value ?? "");
    } catch {
      /* clipboard unavailable */
    }
    setHasCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setHasCopied(false), timeout);
  }, [text, timeout]);

  return { onCopy, hasCopied };
}
