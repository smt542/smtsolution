import type { ReactNode } from "react";

interface TableFrameProps {
  minWidthClassName: string;
  children: ReactNode;
}

/**
 * Lightweight presentational table shell: the horizontal-scroll wrapper plus
 * the raw <table>. Callers own their <thead>/<tbody> (header-row and
 * row-border classes stay with the caller) — this is intentionally NOT the
 * data-driven DataTable from components/common.
 */
export function TableFrame({ minWidthClassName, children }: TableFrameProps) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full ${minWidthClassName} text-sm`}>{children}</table>
    </div>
  );
}
