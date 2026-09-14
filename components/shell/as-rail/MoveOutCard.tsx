import type { StaffMoveOutRequest } from "@/hooks/reactquery/staffMoveOut/apis";

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
      className="block bg-white border border-line rounded-[14px] py-[13px] px-[14px] cursor-pointer no-underline text-inherit hover:border-blue hover:shadow-[0_6px_18px_-10px_rgba(23,31,40,0.25)]"
      href={`/staff/moving-settlement?${query.toString()}`}
    >
      <div className="flex items-center gap-2 mb-[7px]">
        <b className="text-[13.5px] font-extrabold text-t1">
          {request.buildingName ?? "-"} {unitLabel || "-"}호
        </b>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--color-t3)" }}>
          {request.tenantName ?? "-"}
        </span>
        {badge &&
          (badge.cls === "mvNew" ? (
            <span className="ml-auto text-[11.5px] font-extrabold py-[3px] px-2 rounded-[7px] bg-red-t text-red">
              {badge.label}
            </span>
          ) : null)}
      </div>
      <div className="flex justify-between gap-2.5 text-[12.5px] font-medium text-t3 leading-[1.7]">
        <span>신청일</span>
        <b className="font-bold text-t2 tabular-nums">{ymd(request.createdAt)}</b>
      </div>
      <div className="flex justify-between gap-2.5 text-[12.5px] font-medium text-t3 leading-[1.7]">
        <span>희망 퇴실일</span>
        <b className="font-bold text-t2 tabular-nums">{ymd(request.desiredDate)}</b>
      </div>
      <div className="flex justify-between gap-2.5 text-[12.5px] font-medium text-t3 leading-[1.7]">
        <span>연락처</span>
        <b className="font-bold text-t2 tabular-nums">{request.phone ?? "-"}</b>
      </div>
      <div className="mt-[11px] pt-[11px] border-t border-line2">
        <button
          type="button"
          className="w-full h-[36px] border border-blue rounded-[10px] bg-blue text-white text-[13px] font-bold cursor-pointer hover:bg-blue-d hover:border-blue-d"
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
