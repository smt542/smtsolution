import type { ReactNode } from "react";

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
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-t3">
        {label}
        {required && " *"}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-t3">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
