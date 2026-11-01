import type { Complaint } from "@/hooks/reactquery/complaints";

type ExecutionSource = Pick<Complaint, "completedAt" | "resolutions">;
type SortSource = ExecutionSource & Pick<Complaint, "id" | "receivedAt">;

/**
 * A/S 시행일 — 최신 처리이력의 resolved_at, 없으면 completed_at. 둘 다 없으면 null.
 * (resolutions 는 최신순으로 들어온다.)
 */
export function complaintExecutionAt(complaint: ExecutionSource): string | null {
  return complaint.resolutions[0]?.resolvedAt ?? complaint.completedAt ?? null;
}

function toTime(value: string): number {
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

export interface ExecutionSortKey {
  id: number;
  receivedAt: string;
  executionAt: string | null;
}

/** 시행일(없으면 접수일) 오름차순 비교. 동률이면 접수일 → id 순. 내림차순은 인자를 뒤집어 쓴다. */
export function compareByExecution(left: ExecutionSortKey, right: ExecutionSortKey): number {
  return (
    toTime(left.executionAt ?? left.receivedAt) - toTime(right.executionAt ?? right.receivedAt) ||
    toTime(left.receivedAt) - toTime(right.receivedAt) ||
    left.id - right.id
  );
}

export function compareComplaintsByExecution(left: SortSource, right: SortSource): number {
  return compareByExecution(
    { id: left.id, receivedAt: left.receivedAt, executionAt: complaintExecutionAt(left) },
    { id: right.id, receivedAt: right.receivedAt, executionAt: complaintExecutionAt(right) },
  );
}
