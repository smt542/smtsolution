import { formatPhone } from "@/lib/format";

export function PhoneText({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;

  return <span className={className}>{formatPhone(value)}</span>;
}
