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
