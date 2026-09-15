import { cloneElement, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";

export interface FormFieldProps {
  label: ReactNode;
  htmlFor: string;
  required?: boolean;
  error?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  hint,
  children,
  className,
}: FormFieldProps) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;
  const control = isValidElement(children) && children.type !== Fragment
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-invalid": Boolean(error),
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-t3">
        {label}
        {required && " *"}
      </label>
      {control}
      {hint && <p id={hintId} className="mt-1 text-xs text-t3">{hint}</p>}
      {error && <p id={errorId} className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
