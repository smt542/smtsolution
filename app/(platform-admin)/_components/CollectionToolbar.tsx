import type { ReactNode } from "react";

interface CollectionToolbarProps {
  left: ReactNode;
  right: ReactNode;
}

export function CollectionToolbar({ left, right }: CollectionToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
      {left}
      {right}
    </div>
  );
}
