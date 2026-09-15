"use client";

import { useEffect, useState } from "react";

export interface ObjectUrlEntry {
  file: File;
  url: string;
}

export function useObjectUrls(files: readonly File[]): ObjectUrlEntry[] {
  const [entries, setEntries] = useState<ObjectUrlEntry[]>([]);

  useEffect(() => {
    const nextEntries = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    // Object URLs are external resources, so creation and state synchronization
    // intentionally happen together in the effect that owns their cleanup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(nextEntries);

    return () => {
      nextEntries.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [files]);

  return entries;
}
