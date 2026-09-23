"use client";

import { useSyncExternalStore } from "react";

const subscribeToHydration = () => () => undefined;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

// The server QueryClient is always empty, while the client can reuse an already-populated
// cache. Keep the server render and first hydration render on the same snapshot, then
// reveal cached data after commit. Do not call this hook conditionally so hook order stays stable.
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
}
