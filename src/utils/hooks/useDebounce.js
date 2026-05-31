import { useState, useEffect } from "react";

/**
 * Custom hook that debounces a value
 * @param {*} value - The value to debounce
 * @param {number} delay - The debounce delay in milliseconds (default: 500ms)
 * @returns {*} - The debounced value
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};
