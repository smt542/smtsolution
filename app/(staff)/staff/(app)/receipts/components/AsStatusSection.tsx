"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAppToast } from "@/hooks/common/useAppToast";
import { useIsHydrated } from "@/hooks/common";
import { MaskedPhone } from "@/components/common/MaskedPhone";
import { Button, CustomDropdown, Panel, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useAsCategories } from "@/hooks/reactquery/asCategories";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useComplaints,
  useCreateComplaint,
  useCreateComplaintResolution,
  useDeleteComplaint,
  useUpdateComplaint,
  useUpdateComplaintResolution,
  type Complaint,
  type ComplaintInput,
  type ComplaintStatus,
} from "@/hooks/reactquery/complaints";
import { listUnits, unitKeys } from "@/hooks/reactquery/units";
import { openMessengerWith } from "@/lib/messaging/messengerHandoff";
import type { MessageRecipient } from "@/lib/messaging/preset";
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_OPTIONS,
  formatUnitLabel,
} from "../constants";
import type { ComplaintMessageDraft, ResolutionDraft } from "./AsComplaintForm";
import { ComplaintDetailModal } from "./ComplaintDetailModal";
import { ComplaintFormModal } from "./ComplaintFormModal";

interface AsColumn {
  key: string;
  label: string;
  minWidth: number;
  maxWidth?: number;
  align?: "right";
  buildingOnly?: boolean;
}

// 정본 `.rc-as-wrap` th 의 min-width/max-width. 폭은 table-layout:auto 가 내용에 맞춰 나눈다
// (1920 폭에서 재면 예전 Figma 고정값과 같아진다).
const AS_COLUMNS: readonly AsColumn[] = [
  { key: "no", label: "No", minWidth: 38, align: "right" },
  { key: "unit", label: "호수", minWidth: 58, buildingOnly: true },
  { key: "receivedAt", label: "접수일시", minWidth: 86 },
  { key: "type", label: "유형", minWidth: 80 },
  { key: "content", label: "접수내용", minWidth: 240, maxWidth: 300 },
  { key: "phone", label: "입주자 전화번호", minWidth: 112 },
  { key: "result", label: "처리결과", minWidth: 70 },
  { key: "resultContent", label: "처리결과 내용", minWidth: 200, maxWidth: 260 },
  { key: "resolvedAt", label: "시행일자", minWidth: 86 },
  { key: "time", label: "시간", minWidth: 52 },
  { key: "reporter", label: "접수자", minWidth: 66 },
  { key: "assignee", label: "담당자", minWidth: 66 },
];

function visibleAsColumns(scope: "unit" | "building") {
  return AS_COLUMNS.filter((column) => !column.buildingOnly || scope === "building");
}

function AsTableHeader({ scope }: { scope: "unit" | "building" }) {
  return (
    <thead>
      <tr>
        {visibleAsColumns(scope).map((column) => (
          <th
            key={column.key}
            className={`sticky top-0 z-[2] overflow-hidden text-ellipsis whitespace-nowrap border-b border-line bg-[#FBFCFD] px-[16px] py-[11px] text-[12px] font-bold text-t3 ${column.align === "right" ? "text-right" : "text-left"}`}
            style={{ minWidth: column.minWidth, maxWidth: column.maxWidth }}
          >
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

// 정본 `.hf-tbl`(12.5px·nowrap) — 셀 글자는 `.hf-tbl td{13.5px}` 가 정한다.
const AS_TABLE_CLASS = "w-full border-collapse whitespace-nowrap text-[12.5px] leading-[normal]";
// 정본 `#rcAsBody td{height:38px;white-space:nowrap;vertical-align:top}`.
const AS_TD_CLASS = "h-[38px] whitespace-nowrap px-[16px] py-[12px] align-top text-[13.5px]";
// 정본 `#rcAsBody td.memo{white-space:normal;word-break:break-word;line-height:1.5;min-width:240px;max-width:300px}`.
const AS_MEMO_TD_CLASS =
  "h-[38px] min-w-[240px] max-w-[300px] whitespace-normal break-words px-[16px] py-[12px] align-top text-[13.5px] leading-[1.5]";

function AsEmptyTable({ message, scope }: { message: string; scope: "unit" | "building" }) {
  return (
    <table className={AS_TABLE_CLASS}>
      <AsTableHeader scope={scope} />
      <tbody>
        <tr>
          <td colSpan={visibleAsColumns(scope).length} className="py-[26px] text-center text-[13.5px] text-t1">
            {message}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** 정본 표기 `YYYY-MM-DD`(현지 날짜). */
function asDate(value?: string | null): string {
  if (!value) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 정본 시간 칸 `HH:MM`(현지 시각). */
function asTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

const AS_STATUS_BADGE: Record<string, string> = {
  pending: "bg-[#fdecee] text-[#f04452]",
  completed: "bg-[#e6f8f1] text-[#0f7a43]",
  on_hold: "bg-[#fff3e0] text-[#b26a00]",
  repeat: "bg-[#e2f5f1] text-[#0e8677]",
};

/**
 * A/S(민원) 현황·접수 — 세대 스코프. Figma 단일 플랫 폼(추가·상세)으로 재구성.
 * 처리결과 내용은 최신 처리이력 1건으로 upsert하며 기존 이력 데이터는 보존한다.
 */
export function AsStatusSection({
  orgId,
  buildingId,
  unitId,
  canSendMessages,
}: {
  orgId: number;
  buildingId: number | null;
  unitId: number | null;
  canSendMessages: boolean;
}) {
  const toast = useAppToast();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"unit" | "building">("unit");
  const [resultFilter, setResultFilter] = useState<"" | ComplaintStatus>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const isHydrated = useIsHydrated();

  const { data: me } = useMe();
  const { data: buildings = [] } = useBuildings();
  const { data: categories = [] } = useAsCategories();
  const { data: assignees = [] } = useAccounts({ type: "field_staff" });
  const { data: accounts = [] } = useAccounts();
  const { data: complaints = [], isLoading } = useComplaints({
    buildingId: buildingId ?? undefined,
  });

  const createComplaint = useCreateComplaint();
  const updateComplaint = useUpdateComplaint();
  const deleteComplaint = useDeleteComplaint();
  const createResolution = useCreateComplaintResolution();
  const updateResolution = useUpdateComplaintResolution();

  const isComplaintSavePending =
    createComplaint.isPending ||
    updateComplaint.isPending ||
    createResolution.isPending ||
    updateResolution.isPending ||
    deleteComplaint.isPending;

  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.userId, account.fullName])),
    [accounts],
  );

  // 정본 drawAs: No 는 범위(호실/건물 전체) 목록에서 매긴 번호이고, 결과 필터(asFilter)는 그 번호를 유지한 채 거른다.
  const rows = useMemo(
    () =>
      complaints
        .filter((complaint) => !(scope === "unit" && unitId !== null && complaint.unitId !== unitId))
        .map((complaint, index) => ({ complaint, no: index + 1 }))
        .filter(({ complaint }) => !resultFilter || complaint.status === resultFilter),
    [complaints, resultFilter, scope, unitId],
  );

  const selected = complaints.find((complaint) => complaint.id === selectedId) ?? null;

  const closeForm = () => setFormOpen(false);

  const createAs = async (input: ComplaintInput, resolution: ResolutionDraft | null) => {
    try {
      const created = await createComplaint.mutateAsync(input);
      if (resolution) {
        await createResolution.mutateAsync({
          complaintId: created.id,
          resultContent: resolution.resultContent || null,
          resolvedAt: resolution.resolvedAt,
        });
      }
      toast.success("A/S 접수를 등록했어요");
    } catch (error) {
      toast.error(error, "A/S 접수를 저장하지 못했어요");
      throw error;
    }
  };

  const updateAs = async (input: ComplaintInput, resolution: ResolutionDraft | null) => {
    if (!selected) return;
    try {
      await updateComplaint.mutateAsync({ id: selected.id, input });
      if (resolution) {
        const latest = selected.resolutions[0];
        const resolutionInput = {
          resultContent: resolution.resultContent || null,
          resolvedAt: resolution.resolvedAt,
        };
        if (latest) {
          await updateResolution.mutateAsync({
            id: latest.id,
            complaintId: selected.id,
            input: resolutionInput,
          });
        } else {
          await createResolution.mutateAsync({ complaintId: selected.id, ...resolutionInput });
        }
      }
      toast.success("접수 내용을 저장했어요");
    } catch (error) {
      toast.error(error, "A/S 접수를 저장하지 못했어요");
      throw error;
    }
  };

  const removeComplaint = async (complaint: Complaint) => {
    try {
      await deleteComplaint.mutateAsync(complaint.id);
      setSelectedId(null);
      toast.success("접수를 삭제했어요");
    } catch (error) {
      toast.error(error, "A/S 접수를 삭제하지 못했어요");
    }
  };

  const sendComplaintMessage = async (complaint: Complaint, draft: ComplaintMessageDraft) => {
    if (!canSendMessages) {
      toast.warning("문자 발송 권한이 필요해요");
      return;
    }
    setSelectedId(null);

    const draftBuildingId = Number(draft.buildingId);
    const building = buildings.find((item) => item.id === draftBuildingId);
    let unitLabel = "";
    const draftUnitId = Number(draft.unitId);
    if (draft.unitId !== "all" && draftUnitId > 0) {
      try {
        const units = await queryClient.ensureQueryData({
          queryKey: unitKeys.byBuilding(draftBuildingId),
          queryFn: () => listUnits(draftBuildingId),
        });
        const unit = units.find((item) => item.id === draftUnitId);
        unitLabel = unit ? formatUnitLabel(unit) : "";
      } catch {
        if (complaint.unitId === draftUnitId && complaint.unitNo) {
          unitLabel = formatUnitLabel({ unitNo: complaint.unitNo, dong: complaint.unitDong });
        }
      }
    }

    const assignee = assignees.find((account) => account.userId === draft.assignedTo);
    const recipients: MessageRecipient[] = assignee?.phone
      ? [{
          name: assignee.fullName,
          phone: assignee.phone,
          kind: "staff",
          ref: { userId: assignee.userId, buildingId: draftBuildingId },
        }]
      : [];
    const firstLine = [building?.name ?? "", unitLabel, building?.address ?? ""]
      .filter(Boolean)
      .join(" ");
    const body = [
      firstLine,
      `접수 내용 : ${draft.content}`,
      `입주자 전화번호 : ${draft.reporterPhone}`,
    ].join("\n");

    openMessengerWith({ recipients, body, channel: "sms" });
  };

  const action = (
    <div className="flex w-full flex-nowrap items-center gap-[14px]">
      <div className="inline-flex flex-none gap-[2px] rounded-[9px] bg-[#EDF0F3] p-[3px] text-[11.5px] font-bold leading-[normal]">
        <button
          type="button"
          onClick={() => setScope("unit")}
          className={`whitespace-nowrap rounded-[7px] px-[7px] py-[4px] ${
            scope === "unit" ? "bg-surface text-t1" : "text-t3"
          }`}
        >
          호실
        </button>
        <button
          type="button"
          onClick={() => setScope("building")}
          className={`whitespace-nowrap rounded-[7px] px-[7px] py-[4px] ${
            scope === "building" ? "bg-surface text-t1" : "text-t3"
          }`}
        >
          건물 전체
        </button>
      </div>
      <div className="[&_.uc-dd-btn]:h-[28px] [&_.uc-dd-btn]:w-[62px] [&_.uc-dd-btn]:leading-[normal] [&_.uc-dd-btn]:whitespace-nowrap [&_.uc-dd-btn]:px-[9px] [&_.uc-dd-btn]:text-[12px] [&_.uc-dd-menu]:left-0 [&_.uc-dd-menu]:right-auto [&_.uc-dd-menu]:min-w-[96px]">
        <CustomDropdown
          ariaLabel="처리결과 필터"
          value={resultFilter}
          onChange={(value) => setResultFilter(value as "" | ComplaintStatus)}
          options={[{ value: "", label: "전체" }, ...COMPLAINT_STATUS_OPTIONS]}
        />
      </div>
      <Button
        type="button"
        onClick={() => {
          if (buildingId === null) {
            toast.warning("건물을 선택해 주세요");
            return;
          }
          setFormOpen(true);
        }}
        className="ml-auto !flex !h-[26px] items-center gap-[5px] whitespace-nowrap !rounded-[8px] !border !border-line !bg-surface !px-[8px] !text-[11.5px] !leading-[normal] !text-t2 !shadow-none hover:!bg-bg"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          className="size-[13px]"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        접수 추가
      </Button>
    </div>
  );

  return (
    <Panel title="A/S 현황" action={action} actionClassName="flex-1" flush className="h-[320px] shrink-0 [&>div:first-child]:gap-[14px] [&>div:first-child]:px-[12px]">
      {buildingId === null || (scope === "unit" && unitId === null) ? (
        <div className="overflow-x-auto">
          <AsEmptyTable
            scope={scope}
            message={scope === "building" ? "건물을 선택해 주세요" : "건물과 호수를 선택해 주세요"}
          />
        </div>
      ) : !isHydrated || isLoading ? (
        <div className="flex h-[260px] items-center justify-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <div className="overflow-x-auto">
          <AsEmptyTable scope={scope} message="접수 내역이 없어요" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className={AS_TABLE_CLASS}>
            <AsTableHeader scope={scope} />
            <tbody>
              {rows.map(({ complaint, no }) => {
                const latest = complaint.resolutions[0];
                const badgeStyle = AS_STATUS_BADGE[complaint.status] ?? "bg-bg text-t2";
                return (
                  <tr
                    key={complaint.id}
                    onClick={() => setSelectedId(complaint.id)}
                    className="cursor-pointer border-b border-line2 last:border-0 hover:bg-row-hover"
                  >
                    <td className={`${AS_TD_CLASS} text-right num`}>{no}</td>
                    {scope === "building" && (
                      <td className={`${AS_TD_CLASS} num`}>
                        {complaint.unitId === null ? "건물 전체" : complaint.unitNo ?? "-"}
                      </td>
                    )}
                    <td className={`${AS_TD_CLASS} num`}>{asDate(complaint.receivedAt)}</td>
                    <td className={AS_TD_CLASS}>{complaint.categoryLabel ?? "-"}</td>
                    <td className={AS_MEMO_TD_CLASS}>
                      {complaint.title || complaint.content || "-"}
                    </td>
                    {/* MaskedPhone 의 [원문] 버튼(py-0.5·text-xs 16px)이 줄 높이를 20px 로 키우지 않게 셀에서만 덮는다. */}
                    <td className={`${AS_TD_CLASS} num [&_button]:py-0 [&_button]:leading-[normal]`}>
                      {complaint.reporterPhone ? (
                        <MaskedPhone
                          value={complaint.reporterPhone}
                          kind="phone"
                          reveal={{ targetKind: "complaint", targetId: complaint.id, field: "reporter_phone" }}
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className={AS_TD_CLASS}>
                      <span className={`inline-flex items-center rounded-[6px] px-[8px] py-[2px] text-[11px] font-bold leading-[normal] ${badgeStyle}`}>
                        {COMPLAINT_STATUS_LABEL[complaint.status]}
                      </span>
                    </td>
                    <td className={AS_MEMO_TD_CLASS}>{latest?.resultContent || "-"}</td>
                    <td className={`${AS_TD_CLASS} num`}>
                      {asDate(latest?.resolvedAt ?? complaint.completedAt)}
                    </td>
                    <td className={`${AS_TD_CLASS} num`}>{asTime(complaint.receivedAt)}</td>
                    <td className={AS_TD_CLASS}>
                      {complaint.createdBy ? accountNames.get(complaint.createdBy) ?? "-" : "-"}
                    </td>
                    <td className={AS_TD_CLASS}>
                      {complaint.assignedTo ? accountNames.get(complaint.assignedTo) ?? "-" : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {formOpen && (
        <ComplaintFormModal
          open
          orgId={orgId}
          buildings={buildings}
          categories={categories}
          assignees={assignees}
          createDefaults={{
            buildingId,
            unitId: scope === "building" ? "all" : unitId,
          }}
          receiverName={me?.fullName ?? "-"}
          isPending={isComplaintSavePending}
          onClose={closeForm}
          onSubmit={createAs}
        />
      )}

      {selected && (
        <ComplaintDetailModal
          open
          complaint={selected}
          receiverName={selected.createdBy ? accountNames.get(selected.createdBy) ?? "-" : "-"}
          orgId={orgId}
          buildings={buildings}
          categories={categories}
          assignees={assignees}
          isPending={isComplaintSavePending}
          onClose={() => setSelectedId(null)}
          onSubmit={updateAs}
          onDelete={removeComplaint}
          onSendMessage={sendComplaintMessage}
        />
      )}
    </Panel>
  );
}
