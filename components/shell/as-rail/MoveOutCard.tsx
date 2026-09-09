import type { StaffMoveOutRequest } from "@/hooks/reactquery/staffMoveOut/apis";

import styles from "./AsRail.module.css";
import { MOVE_OUT_BADGE, ymd } from "./constants";

interface MoveOutCardProps {
  request: StaffMoveOutRequest;
  onDone: (request: StaffMoveOutRequest) => void;
}

export function MoveOutCard({ request, onDone }: MoveOutCardProps) {
  const badge =
    request.status === "pending" || request.status === "confirmed"
      ? MOVE_OUT_BADGE[request.status]
      : null;
  const unitLabel = `${request.unitDong ?? ""}${request.unitNo ?? ""}`;
  const query = new URLSearchParams({
    bld: request.buildingId === null ? "" : String(request.buildingId),
    unit: request.unitId === null ? "" : String(request.unitId),
    req: String(request.id),
  });

  return (
    <a
      className={styles.mvCard}
      href={`/staff/moving-settlement?${query.toString()}`}
    >
      <div className={styles.mvTop}>
        <b>
          {request.buildingName ?? "-"} {unitLabel || "-"}호
        </b>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t3)" }}>
          {request.tenantName ?? "-"}
        </span>
        {badge && (
          <span className={`${styles.mvSt} ${styles[badge.cls]}`}>
            {badge.label}
          </span>
        )}
      </div>
      <div className={styles.mvR}>
        <span>신청일</span>
        <b>{ymd(request.createdAt)}</b>
      </div>
      <div className={styles.mvR}>
        <span>희망 퇴실일</span>
        <b>{ymd(request.desiredDate)}</b>
      </div>
      <div className={styles.mvR}>
        <span>연락처</span>
        <b>{request.phone ?? "-"}</b>
      </div>
      <div className={styles.mvAct}>
        <button
          type="button"
          className={styles.mvDone}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDone(request);
          }}
        >
          처리 완료
        </button>
      </div>
    </a>
  );
}
