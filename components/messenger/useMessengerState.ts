"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChannelMode, MessengerUiState } from "./types";

const KEY = "messenger:ui";
const DEFAULT: MessengerUiState = {
  open: false,
  minimized: false,
  pos: null,
  channel: "sms",
};

export function useMessengerState() {
  const [ui, setUi] = useState<MessengerUiState>(DEFAULT);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted UI state after mount
      if (raw) setUi({ ...DEFAULT, ...JSON.parse(raw) });
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(ui));
    } catch {
      /* noop */
    }
  }, [ui]);

  const openPanel = useCallback(
    () => setUi((s) => ({ ...s, open: true, minimized: false })),
    [],
  );
  const closePanel = useCallback(
    () => setUi((s) => ({ ...s, open: false, minimized: false })),
    [],
  );
  const toggleMin = useCallback(
    () => setUi((s) => ({ ...s, minimized: !s.minimized })),
    [],
  );
  const setPos = useCallback(
    (pos: MessengerUiState["pos"]) => setUi((s) => ({ ...s, pos })),
    [],
  );
  const setChannel = useCallback(
    (channel: ChannelMode) => setUi((s) => ({ ...s, channel })),
    [],
  );

  return { ui, openPanel, closePanel, toggleMin, setPos, setChannel };
}
