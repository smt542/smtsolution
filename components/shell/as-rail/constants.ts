import type { ComplaintStatus } from "@/hooks/reactquery/complaints";

export const AS_STATUS_LABEL: Record<ComplaintStatus, string> = {
  pending: "미결",
  on_hold: "보류",
  completed: "완결",
  repeat: "반복",
};

export const AS_STATUS_COLOR: Record<ComplaintStatus, string> = {
  pending: "var(--red)",
  on_hold: "var(--amber)",
  completed: "var(--green)",
  repeat: "var(--amber)",
};

export const MOVE_OUT_BADGE = {
  pending: { label: "신규", cls: "mvNew" as const },
  confirmed: { label: "확인", cls: "mvCk" as const },
};

/** 퇴실 신청 카드 제목·처리 완료 모달 이름(정본 `.mv-top b` = "그린빌라 101호"). 호실 번호에 이미 '호'가 있으면 한 번만 붙인다. */
export function moveOutUnitTitle(request: {
  buildingName: string | null;
  unitDong: string | null;
  unitNo: string | null;
}): string {
  const unit = `${request.unitDong ?? ""}${request.unitNo ?? ""}`.replace(/호$/, "");
  return `${request.buildingName ?? "-"} ${unit || "-"}호`;
}

function d(iso?: string | null): Date | null {
  if (!iso) return null;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const p2 = (n: number) => String(n).padStart(2, "0");

export function mmdd(iso?: string | null): string {
  const dt = d(iso);
  return dt ? `${p2(dt.getMonth() + 1)}.${p2(dt.getDate())}` : "-";
}

export function hhmm(iso?: string | null): string {
  const dt = d(iso);
  return dt ? `${p2(dt.getHours())}:${p2(dt.getMinutes())}` : "-";
}

export function ymd(iso?: string | null): string {
  const dt = d(iso);
  return dt
    ? `${dt.getFullYear()}.${p2(dt.getMonth() + 1)}.${p2(dt.getDate())}`
    : "-";
}
