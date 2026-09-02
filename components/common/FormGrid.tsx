import type { ReactNode } from "react";

export function FormGrid({
  children,
  columnsClassName = "grid-cols-2",
}: {
  children: ReactNode;
  columnsClassName?: string;
}) {
  return <div className={`grid ${columnsClassName} gap-x-[18px] gap-y-[16px]`}>{children}</div>;
}
