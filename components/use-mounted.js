"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

// true after hydration, false during SSR — without a setState-in-effect.
export function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

// Reactive media query, SSR-safe (returns fallback on the server).
export function useMediaQuery(query, fallback = false) {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => fallback
  );
}
