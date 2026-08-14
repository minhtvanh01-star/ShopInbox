"use client";

import { useCallback, useSyncExternalStore } from "react";

function dispatchPersist(key: string) {
  window.dispatchEvent(new CustomEvent("persisted-state", { detail: key }));
}

export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const handler = (event: Event) => {
        const detail = (event as CustomEvent<string>).detail;
        if (!detail || detail === key) {
          onStoreChange();
        }
      };
      window.addEventListener("persisted-state", handler);
      window.addEventListener("storage", handler);
      return () => {
        window.removeEventListener("persisted-state", handler);
        window.removeEventListener("storage", handler);
      };
    },
    [key],
  );

  const getSnapshot = useCallback((): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  }, [key, initial]);

  const getServerSnapshot = useCallback(() => initial, [initial]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (prev: T) => T)(getSnapshot()) : next;
      localStorage.setItem(key, JSON.stringify(resolved));
      dispatchPersist(key);
    },
    [key, getSnapshot],
  );

  return [value, setValue];
}
