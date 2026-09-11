"use client";

import { useRouter } from "next/navigation";

import type { Complaint } from "@/hooks/reactquery/complaints";

import { AS_STATUS_COLOR, AS_STATUS_LABEL, hhmm, mmdd } from "./constants";

interface AsReceptionCardProps {
  complaint: Complaint;
  nameOf: (id?: string | null) => string;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  "var(--red)": "bg-red-t text-red",
  "var(--amber)": "bg-amber-t text-amber",
  "var(--green)": "bg-green-t text-green",
};

export function AsReceptionCard({ complaint, nameOf }: AsReceptionCardProps) {
  const router = useRouter();
  const resolution = complaint.resolutions[0];
  const unitLabel = `${complaint.unitDong ?? ""}${complaint.unitNo ?? ""}`;
  const location = [complaint.buildingName ?? "-", unitLabel]
    .filter(Boolean)
    .join(" ");
  const statusBadgeClass =
    STATUS_BADGE_CLASS[AS_STATUS_COLOR[complaint.status]] ?? "";

  return (
    <a
      className="block bg-white border border-line rounded-[12px] py-[14px] px-4 no-underline text-inherit cursor-pointer transition-all duration-[120ms] hover:border-blue hover:shadow-[0_6px_16px_-8px_rgba(20,164,151,0.25)]"
      href="/staff/receipts"
      onClick={(event) => {
        event.preventDefault();
        router.push("/staff/receipts");
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-extrabold">
          #{complaint.id} · {location}
        </div>
        <span
          className={`inline-flex items-center text-[11.5px] font-extrabold py-[3px] px-2 rounded-[7px] ${statusBadgeClass}`}
        >
          {AS_STATUS_LABEL[complaint.status]}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="inline-flex text-[11.5px] font-bold text-t3 border border-line rounded-[6px] py-0.5 px-2 bg-transparent">
          {complaint.categoryLabel ?? "-"}
        </span>
        <span className="num text-[12px] text-t3 font-semibold">
          {hhmm(complaint.receivedAt)}
        </span>
        <span className="text-[12px] text-t3 font-semibold ml-auto">
          {nameOf(complaint.assignedTo)}
        </span>
      </div>
      <div className="text-[13px] text-t2 font-semibold mt-2 leading-[1.5] whitespace-normal">
        {complaint.content ?? complaint.title}
      </div>
      <div className="h-px bg-line2 mt-[10px] mb-1" />
      <div className="flex justify-between gap-2 text-[12px] mt-[5px]">
        <span className="text-t3 font-semibold">접수일 / 시행일</span>
        <span className="font-bold text-t2 num">
          {mmdd(complaint.receivedAt)} /{" "}
          {mmdd(complaint.completedAt ?? resolution?.resolvedAt)}
        </span>
      </div>
      <div className="flex justify-between gap-2 text-[12px] mt-[5px]">
        <span className="text-t3 font-semibold">접수시 전화</span>
        <span className="font-bold text-t2 num">{complaint.reporterPhone ?? "-"}</span>
      </div>
      <div className="flex justify-between gap-2 text-[12px] mt-[5px]">
        <span className="text-t3 font-semibold">담당자 / 접수</span>
        <span className="font-bold text-t2">
          {nameOf(complaint.assignedTo)} / {nameOf(complaint.createdBy)}
        </span>
      </div>
      <div className="flex justify-between gap-2 text-[12px] mt-[5px]">
        <span className="text-t3 font-semibold">처리결과</span>
        <span className="font-bold text-t2">{resolution?.resultContent ?? "-"}</span>
      </div>
    </a>
  );
}
