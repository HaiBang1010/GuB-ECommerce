import { useEffect, useState } from 'react';

// Returns `value` delayed by `delayMs` — the debounced value only updates once the
// input stops changing for that long. Used to throttle the admin order search so
// each keystroke doesn't fire a request.
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
