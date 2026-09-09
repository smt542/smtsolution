"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "as-rail:open";

export function useRailOpen() {
  const [open, setOpenState] = useState(false);

  useEffect(() => {
    try {
      // The persisted browser value is intentionally restored after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpenState(window.localStorage.getItem(KEY) === "1");
    } catch {
      // localStorage can be unavailable in restricted browser contexts.
    }
  }, []);

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    try {
      window.localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      // Keep the in-memory state when persistence is unavailable.
    }
  }, []);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  return { open, toggle, setOpen };
}
