import type { ReactNode } from "react";

/** Figma field label: 12.5px Bold #4E5968, optional red asterisk + grey inline hint. */
export function FieldLabel({
  children,
  required,
  hint,
}: {
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <p className="text-[12.5px] font-bold leading-none text-t2">
      {children}
      {required && <span className="text-red">{" *"}</span>}
      {hint && <span className="font-semibold text-t3">{hint}</span>}
    </p>
  );
}
