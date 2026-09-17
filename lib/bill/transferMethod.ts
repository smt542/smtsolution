export type TransferMethodOption = { value: string; label: string };

export const transferMethodOptions: TransferMethodOption[] = [
  { value: "giro", label: "지로" },
  { value: "transfer", label: "이체" },
  { value: "auto_transfer", label: "자동이체" },
  { value: "deposit", label: "입금" },
  { value: "none", label: "없음" },
];

export function transferMethodLabel(value: string | null | undefined): string {
  return transferMethodOptions.find((option) => option.value === value)?.label
    ?? transferMethodOptions.find((option) => option.value === "none")?.label
    ?? "없음";
}
