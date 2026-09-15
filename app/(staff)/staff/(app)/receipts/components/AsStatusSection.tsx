"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, CustomDropdown, Panel, Spinner } from "@/components/common";
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
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import type { MessagingPreset } from "@/lib/messaging/preset";
import { MessagingModal } from "../../messaging/components/MessagingModal";
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_OPTIONS,
  formatComplaintDate,
  formatUnitLabel,
} from "../constants";
import type { ResolutionDraft } from "./AsComplaintForm";
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

const AS_COLUMNS: readonly AsColumn[] = [
  { key: "no", label: "No", minWidth: 48, align: "right" },
  { key: "unit", label: "호수", minWidth: 58, buildingOnly: true },
  { key: "receivedAt", label: "접수일시", minWidth: 110 },
  { key: "type", label: "유형", minWidth: 90 },
  { key: "content", label: "접수내용", minWidth: 285, maxWidth: 300 },
  { key: "phone", label: "입주자 전화번호", minWidth: 135 },
  { key: "result", label: "처리결과", minWidth: 73 },
  { key: "resultContent", label: "처리결과 내용", minWidth: 240, maxWidth: 260 },
  { key: "resolvedAt", label: "시행일자", minWidth: 110 },
  { key: "time", label: "시간", minWidth: 69 },
  { key: "reporter", label: "접수자", minWidth: 67 },
  { key: "assignee", label: "담당자", minWidth: 67 },
];

function visibleAsColumns(scope: "unit" | "building") {
  return AS_COLUMNS.filter((column) => !column.buildingOnly || scope === "building");
}

function AsTableHeader({ scope }: { scope: "unit" | "building" }) {
  return (
    <thead>
      <tr className="border-b border-[#e8ebee] bg-[#fbfcfd] text-[12px] font-bold leading-[normal] text-[#8b95a1]">
        {visibleAsColumns(scope).map((column) => (
          <th
            key={column.key}
            className={`overflow-hidden text-ellipsis whitespace-nowrap px-[16px] py-[11px] ${column.align === "right" ? "text-right" : ""}`}
            style={{ minWidth: column.minWidth, maxWidth: column.maxWidth }}
          >
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function AsEmptyTable({ message, scope }: { message: string; scope: "unit" | "building" }) {
  return (
    <table className="w-full border-collapse whitespace-nowrap text-[13.5px] leading-[normal]">
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
  resident,
}: {
  orgId: number;
  buildingId: number | null;
  unitId: number | null;
  canSendMessages: boolean;
  resident: {
    occupancyId: number;
    name: string | null;
    phone: string | null;
    alimtalkOptIn: boolean;
  } | null;
}) {
  const [scope, setScope] = useState<"unit" | "building">("unit");
  const [resultFilter, setResultFilter] = useState<"" | ComplaintStatus>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [messagingPreset, setMessagingPreset] = useState<MessagingPreset | null>(null);

  const { data: buildings = [] } = useBuildings();
  const { data: categories = [] } = useAsCategories();
  const { data: assignees = [] } = useAccounts({ type: "field_staff" });
  const { data: complaints = [], isLoading } = useComplaints({
    buildingId: buildingId ?? undefined,
  });
  const { data: orgContact } = useOrgContact();

  const createComplaint = useCreateComplaint();
  const updateComplaint = useUpdateComplaint();
  const deleteComplaint = useDeleteComplaint();
  const createResolution = useCreateComplaintResolution();
  const updateResolution = useUpdateComplaintResolution();

  const isSaving =
    createComplaint.isPending ||
    updateComplaint.isPending ||
    createResolution.isPending ||
    updateResolution.isPending ||
    deleteComplaint.isPending;

  const assigneeNames = useMemo(
    () => new Map(assignees.map((account) => [account.userId, account.fullName])),
    [assignees],
  );

  const rows = useMemo(
    () =>
      complaints.filter((complaint) => {
        if (scope === "unit" && unitId !== null && complaint.unitId !== unitId) return false;
        if (resultFilter && complaint.status !== resultFilter) return false;
        return true;
      }),
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
      toast.success("A/S 접수가 저장되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.");
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
      toast.success("A/S 접수를 저장했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.");
      throw error;
    }
  };

  const removeComplaint = async (complaint: Complaint) => {
    try {
      await deleteComplaint.mutateAsync(complaint.id);
      setSelectedId(null);
      toast.success("A/S 접수를 삭제했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  // 확인문자 보내기 = 입주자 안내(알림톡 자동 라우팅, 미동의 시 SMS 전환) — 기존 통합 유지.
  const messageResident = (complaint: Complaint) => {
    if (!canSendMessages) {
      toast.info("문자 발송 권한이 필요합니다.");
      return;
    }
    if (!resident?.occupancyId || !resident.phone) {
      toast.info("입주자 연락처가 등록되어 있지 않습니다.");
      return;
    }

    const assignee = assignees.find((account) => account.userId === complaint.assignedTo);
    const unit = formatUnitLabel({ unitNo: complaint.unitNo, dong: complaint.unitDong });
    const buildingName =
      complaint.buildingName ??
      buildings.find((building) => building.id === complaint.buildingId)?.name ??
      "";

    setMessagingPreset({
      context: "민원·AS",
      buildingId: complaint.buildingId,
      channel: "alimtalk",
      mode: "auto",
      templateTitle: "민원·AS 처리 안내",
      recipients: [
        {
          name: resident.name,
          phone: resident.phone,
          unitNo: unit,
          kind: "tenant",
          alimtalkOptIn: resident.alimtalkOptIn,
          variables: {
            세대: unit,
            접수내용: complaint.content ?? complaint.title,
            처리상태: COMPLAINT_STATUS_LABEL[complaint.status],
            담당자: assignee?.fullName ?? "",
          },
          ref: {
            occupancyId: resident.occupancyId,
            unitId: complaint.unitId ?? undefined,
            buildingId: complaint.buildingId,
          },
        },
      ],
      commonVariables: {
        건물명: buildingName,
        관리사무소연락처: orgContact?.phone ?? "",
      },
    });
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
      <div className="[&_.uc-dd-btn]:h-[28px] [&_.uc-dd-btn]:w-[62px] [&_.uc-dd-btn]:whitespace-nowrap [&_.uc-dd-btn]:px-[9px] [&_.uc-dd-btn]:text-[12px] [&_.uc-dd-menu]:left-0 [&_.uc-dd-menu]:right-auto [&_.uc-dd-menu]:min-w-[96px]">
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
            toast.info("건물을 먼저 선택해 주세요.");
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
          strokeWidth="2"
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
      ) : isLoading ? (
        <div className="flex h-[260px] items-center justify-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <div className="overflow-x-auto">
          <AsEmptyTable scope={scope} message="접수 내역이 없어요" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse whitespace-nowrap text-[13.5px] leading-[normal]">
            <AsTableHeader scope={scope} />
            <tbody>
              {rows.map((complaint, index) => {
                const latest = complaint.resolutions[0];
                const badgeStyle = AS_STATUS_BADGE[complaint.status] ?? "bg-bg text-t2";
                return (
                  <tr
                    key={complaint.id}
                    onClick={() => setSelectedId(complaint.id)}
                    className="cursor-pointer border-b border-[#f1f3f5] last:border-0 hover:bg-bg"
                  >
                    <td className="px-[16px] py-[12px] text-right num">{index + 1}</td>
                    {scope === "building" && (
                      <td className="whitespace-nowrap px-[16px] py-[12px] num">
                        {complaint.unitId === null ? "건물 전체" : complaint.unitNo ?? "-"}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-[16px] py-[12px] num">
                      {formatComplaintDate(complaint.receivedAt, true)}
                    </td>
                    <td className="px-[16px] py-[12px]">{complaint.categoryLabel ?? "-"}</td>
                    <td className="min-w-[240px] max-w-[300px] whitespace-normal break-words px-[16px] py-[12px] leading-[1.5]">
                      {complaint.title || complaint.content || "-"}
                    </td>
                    <td className="whitespace-nowrap px-[16px] py-[12px] num">
                      {complaint.reporterPhone ?? "-"}
                    </td>
                    <td className="px-[16px] py-[12px]">
                      <span className={`inline-flex items-center rounded-[6px] px-[8px] py-[2px] text-[11px] font-bold leading-[normal] ${badgeStyle}`}>
                        {COMPLAINT_STATUS_LABEL[complaint.status]}
                      </span>
                    </td>
                    <td className="min-w-[240px] max-w-[300px] whitespace-normal break-words px-[16px] py-[12px] leading-[1.5]">
                      {latest?.resultContent ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-[16px] py-[12px] num">
                      {formatComplaintDate(latest?.resolvedAt ?? complaint.completedAt)}
                    </td>
                    <td className="whitespace-nowrap px-[16px] py-[12px] num">
                      {complaint.receivedAt?.slice(11, 16) || "-"}
                    </td>
                    <td className="px-[16px] py-[12px]">
                      {complaint.createdBy ? assigneeNames.get(complaint.createdBy) ?? "-" : "-"}
                    </td>
                    <td className="px-[16px] py-[12px]">
                      {complaint.assignedTo ? assigneeNames.get(complaint.assignedTo) ?? "-" : "-"}
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
          isPending={isSaving}
          onClose={closeForm}
          onSubmit={createAs}
        />
      )}

      {selected && (
        <ComplaintDetailModal
          open
          complaint={selected}
          orgId={orgId}
          buildings={buildings}
          categories={categories}
          assignees={assignees}
          isPending={isSaving}
          onClose={() => setSelectedId(null)}
          onSubmit={updateAs}
          onDelete={removeComplaint}
          onSendMessage={messageResident}
        />
      )}

      {messagingPreset && (
        <MessagingModal
          open
          preset={messagingPreset}
          onClose={() => setMessagingPreset(null)}
          onSent={(result) => {
            toast.success(`문자가 발송되었습니다. (성공 ${result.count}건)`);
            setMessagingPreset(null);
          }}
        />
      )}
    </Panel>
  );
}
