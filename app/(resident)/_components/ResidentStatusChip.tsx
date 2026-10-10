import type { ResidentBillPayStatus } from "@/hooks/reactquery/residentBilling";

/** 칩 상태: 완납 · 부분납부(일부만 냄 — 연체료만 남은 달 포함) · 미납 */
export type ResidentChipStatus = "paid" | "partial" | "unpaid";

/** 관리비 내역 pay_status → 칩 상태. 부과가 없는 달(none)은 완납으로 본다. */
export const residentChipStatus = (payStatus: ResidentBillPayStatus): ResidentChipStatus =>
  payStatus === "paid" || payStatus === "none" ? "paid" : payStatus === "partial" ? "partial" : "unpaid";

const CHIP: Record<ResidentChipStatus, { label: string; tone: string }> = {
  paid: { label: "완납", tone: "bg-blue-t text-blue-d" },
  partial: { label: "부분납부", tone: "bg-amber-t text-amber" },
  unpaid: { label: "미납", tone: "bg-red-t text-red" },
};

type ResidentStatusChipProps = {
  paid: boolean;
  /** 지정하면 paid 대신 이 상태로 표시(부분납부 구분용). */
  status?: ResidentChipStatus;
  className?: string;
};

export default function ResidentStatusChip({
  paid,
  status,
  className,
}: ResidentStatusChipProps) {
  const chip = CHIP[status ?? (paid ? "paid" : "unpaid")];
  return (
    <span
      className={`flex-none rounded-lg px-[9px] py-1 text-[11.5px] font-extrabold leading-[normal] ${chip.tone}${className ? ` ${className}` : ""}`}
    >
      {chip.label}
    </span>
  );
}
