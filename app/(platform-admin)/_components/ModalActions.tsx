import type { ReactNode } from "react";

/**
 * Right-aligned modal/form action row. Children are the action buttons.
 */
export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 pt-2">{children}</div>;
}
