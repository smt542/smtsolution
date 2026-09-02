"use client";

import { useEffect, type ReactNode } from "react";

import styles from "./ResidentBottomSheet.module.css";

type ResidentBottomSheetProps = {
  id?: string;
  variant: "compact" | "stepped";
  open: boolean;
  onDismiss: () => void;
  children: ReactNode;
};

const panelClassByVariant = {
  compact: styles.panelCompact,
  stepped: styles.panelStepped,
} as const;

const grabClassByVariant = {
  compact: styles.grabCompact,
  stepped: styles.grabStepped,
} as const;

export default function ResidentBottomSheet({
  id,
  variant,
  open,
  onDismiss,
  children,
}: ResidentBottomSheetProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onDismiss();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onDismiss]);

  return (
    <div
      id={id}
      className={`${styles.sheet} ${open ? styles.show : ""}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <div className={panelClassByVariant[variant]}>
        <div className={grabClassByVariant[variant]} />
        {children}
      </div>
    </div>
  );
}
