"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, EmptyState, Panel, Select, Spinner } from "@/components/common";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useAsCategories } from "@/hooks/reactquery/asCategories";
import { useBuildings } from "@/hooks/reactquery/buildings";
import {
  useComplaints,
  useCreateComplaint,
  useCreateComplaintResolution,
  useDeleteComplaint,
  useDeleteComplaintResolution,
  useUpdateComplaint,
  useUpdateComplaintResolution,
  useUpdateComplaintStatus,
  type Complaint,
  type ComplaintInput,
  type ComplaintResolution,
  type ComplaintResolutionInput,
  type ComplaintStatus,
} from "@/hooks/reactquery/complaints";
import { useOrgContact } from "@/hooks/reactquery/org/useOrgContact";
import type { MessagingPreset } from "@/lib/messaging/preset";
import { MessagingModal } from "../../messaging/components/MessagingModal";
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_OPTIONS,
  COMPLAINT_STATUS_STYLE,
  formatComplaintDate,
  formatUnitLabel,
} from "../constants";
import { ComplaintDetailModal } from "./ComplaintDetailModal";
import { ComplaintFormModal } from "./ComplaintFormModal";

const AS_COLUMNS = [
  "No",
  "접수일시",
  "유형",
  "접수내용",
  "입주자 전화번호",
  "처리결과",
  "처리결과 내용",
  "시행일자",
  "시간",
  "접수자",
  "담당자",
];
const AS_COLUMN_WIDTHS = [50, 111, 90, 285, 135, 105, 207, 111, 70, 65, 63];

function AsTableColumns() {
  return (
    <colgroup>
      {AS_COLUMN_WIDTHS.map((width, index) => <col key={index} style={{ width }} />)}
    </colgroup>
  );
}

function AsTableHeader() {
  return (
    <thead>
      <tr className="h-[37px] border-b border-line bg-bg text-left text-xs font-bold text-t3">
        {AS_COLUMNS.map((label, index) => (
          <th key={label} className={`px-3 ${index === 0 ? "text-right" : ""}`}>{label}</th>
        ))}
      </tr>
    </thead>
  );
}

/**
 * A/S(민원) 현황·접수 — 세대 스코프. 기존 민원 CRUD 컴포넌트를 재사용.
 * P2에서 확인문자를 상세폼 단문 방식으로 단일화 예정.
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
  const [editing, setEditing] = useState<Complaint | null>(null);
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
  const updateStatus = useUpdateComplaintStatus();
  const deleteComplaint = useDeleteComplaint();
  const createResolution = useCreateComplaintResolution();
  const updateResolution = useUpdateComplaintResolution();
  const deleteResolution = useDeleteComplaintResolution();

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

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (complaint: Complaint) => {
    setSelectedId(null);
    setEditing(complaint);
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  const saveComplaint = async (input: ComplaintInput) => {
    try {
      if (editing) await updateComplaint.mutateAsync({ id: editing.id, input });
      else await createComplaint.mutateAsync(input);
      toast.success("민원·AS 접수가 저장되었습니다.");
      closeForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.");
      throw error;
    }
  };

  const changeStatus = async (complaint: Complaint, status: ComplaintStatus) => {
    if (complaint.status === status) return;
    try {
      await updateStatus.mutateAsync({ id: complaint.id, status });
      toast.success(`상태를 ${COMPLAINT_STATUS_LABEL[status]}로 변경했습니다.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "상태 변경에 실패했습니다.");
    }
  };

  const removeComplaint = async (complaint: Complaint) => {
    try {
      await deleteComplaint.mutateAsync(complaint.id);
      setSelectedId(null);
      toast.success("민원·AS 접수를 삭제했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    }
  };

  const addResolution = async (input: ComplaintResolutionInput) => {
    try {
      await createResolution.mutateAsync(input);
      toast.success("처리이력을 추가했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "처리이력 저장에 실패했습니다.");
      throw error;
    }
  };
  const editResolution = async (
    resolution: ComplaintResolution,
    input: Partial<ComplaintResolutionInput>,
  ) => {
    try {
      await updateResolution.mutateAsync({
        id: resolution.id,
        complaintId: resolution.complaintId,
        input,
      });
      toast.success("처리이력을 수정했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "처리이력 수정에 실패했습니다.");
      throw error;
    }
  };
  const removeResolution = async (resolution: ComplaintResolution) => {
    try {
      await deleteResolution.mutateAsync({
        id: resolution.id,
        complaintId: resolution.complaintId,
      });
      toast.success("처리이력을 삭제했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "처리이력 삭제에 실패했습니다.");
    }
  };

  const messageAssignee = (complaint: Complaint) => {
    if (!canSendMessages) {
      toast.info("문자 발송 권한이 필요합니다.");
      return;
    }
    const assignee = assignees.find((account) => account.userId === complaint.assignedTo);
    if (!assignee?.phone) {
      toast.info("담당 기사 연락처가 등록되어 있지 않습니다.");
      return;
    }
    // A/S 확인문자 = 상세폼 단문 방식(건물·호수·접수내용·전화)으로 단일화 — 3종 템플릿 모달 미사용.
    const unit = formatUnitLabel({ unitNo: complaint.unitNo, dong: complaint.unitDong });
    setMessagingPreset({
      context: "A/S 확인",
      channel: "sms",
      body: `[${complaint.buildingName ?? "건물"} ${unit}] A/S 접수 안내\n유형: ${complaint.categoryLabel ?? "-"}\n접수내용: ${complaint.content ?? complaint.title}\n입주자 연락처: ${complaint.reporterPhone ?? "-"}`,
      recipients: [
        {
          name: assignee.fullName,
          phone: assignee.phone,
          kind: "staff",
          ref: { userId: assignee.userId },
        },
      ],
    });
  };

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
    const buildingName = complaint.buildingName
      ?? buildings.find((building) => building.id === complaint.buildingId)?.name
      ?? "";

    setMessagingPreset({
      context: "민원·AS",
      buildingId: complaint.buildingId,
      channel: "alimtalk",
      mode: "auto",
      templateTitle: "민원·AS 처리 안내",
      recipients: [{
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
      }],
      commonVariables: {
        건물명: buildingName,
        관리사무소연락처: orgContact?.phone ?? "",
      },
    });
  };

  const action = (
    <div className="flex w-full flex-nowrap items-center gap-[8px]">
      <div className="flex rounded-lg border border-line bg-bg p-0.5 text-xs font-bold">
        <button
          type="button"
          onClick={() => setScope("unit")}
          disabled={unitId === null}
          className={`rounded-md px-2 py-1 disabled:opacity-40 ${
            scope === "unit" ? "bg-surface text-t1 shadow-sm" : "text-t3"
          }`}
        >
          호실
        </button>
        <button
          type="button"
          onClick={() => setScope("building")}
          className={`rounded-md px-2 py-1 ${
            scope === "building" ? "bg-surface text-t1 shadow-sm" : "text-t3"
          }`}
        >
          건물 전체
        </button>
      </div>
      <Select
        className="!h-[30px] !w-[72px] !rounded-[8px] !px-[10px] !text-[12px]"
        aria-label="처리결과 필터"
        value={resultFilter}
        onChange={(event) => setResultFilter(event.target.value as "" | ComplaintStatus)}
        options={[{ value: "", label: "전체" }, ...COMPLAINT_STATUS_OPTIONS]}
      />
      <Button
        type="button"
        onClick={openCreate}
        disabled={buildingId === null}
        className="ml-auto !h-[30px] whitespace-nowrap !rounded-[8px] !border !border-line !bg-surface !px-[11px] !text-[12px] !text-t2 !shadow-none hover:!bg-bg"
      >
        + 접수 추가
      </Button>
    </div>
  );

  return (
    <Panel title="A/S 현황" action={action} actionClassName="ml-[14px] flex-1" flush>
      {buildingId === null ? (
        <div className="overflow-x-auto">
          <table className="w-[1292px] table-fixed text-sm"><AsTableColumns /><AsTableHeader /></table>
          <p className="flex h-[223px] min-w-[1292px] items-center justify-center text-[13px] text-t4">건물과 호수를 선택해 주세요</p>
        </div>
      ) : isLoading ? (
        <div className="flex h-[260px] items-center justify-center"><Spinner /></div>
      ) : rows.length === 0 ? (
        <div className="overflow-x-auto">
          <table className="w-[1292px] table-fixed text-sm"><AsTableColumns /><AsTableHeader /></table>
          <div className="flex h-[223px] min-w-[1292px] items-center justify-center"><EmptyState message="접수된 A/S가 없습니다" /></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-[1292px] table-fixed text-sm">
            <AsTableColumns />
            <AsTableHeader />
            <tbody>
              {rows.map((complaint, index) => {
                const latest = complaint.resolutions[complaint.resolutions.length - 1];
                return (
                  <tr
                    key={complaint.id}
                    onClick={() => setSelectedId(complaint.id)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-bg"
                  >
                    <td className="px-3 py-3 text-right text-t3 num">{index + 1}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-t2">
                      {formatComplaintDate(complaint.receivedAt, true)}
                    </td>
                    <td className="px-3 py-3 text-t2">{complaint.categoryLabel ?? "-"}</td>
                    <td className="max-w-[220px] truncate px-3 py-3 text-t1">
                      {complaint.title || complaint.content || "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-t2">
                      {complaint.reporterPhone ?? "-"}
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        className={`px-2 py-1 ${COMPLAINT_STATUS_STYLE[complaint.status]}`}
                      >
                        {COMPLAINT_STATUS_LABEL[complaint.status]}
                      </Badge>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-3 text-t2">
                      {latest?.resultContent ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-t2">
                      {formatComplaintDate(complaint.completedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-t2">
                      {complaint.receivedAt?.slice(11, 16) || "-"}
                    </td>
                    <td className="px-3 py-3 text-t2">
                      {complaint.createdBy ? assigneeNames.get(complaint.createdBy) ?? "-" : "-"}
                    </td>
                    <td className="px-3 py-3 text-t2">
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
          editing={editing}
          orgId={orgId}
          buildings={buildings}
          categories={categories}
          assignees={assignees}
          isPending={createComplaint.isPending || updateComplaint.isPending}
          onClose={closeForm}
          onSubmit={saveComplaint}
        />
      )}

      {selected && (
        <ComplaintDetailModal
          open
          complaint={selected}
          assignees={assignees}
          isComplaintPending={updateStatus.isPending || deleteComplaint.isPending}
          isResolutionPending={
            createResolution.isPending || updateResolution.isPending || deleteResolution.isPending
          }
          onClose={() => setSelectedId(null)}
          onEdit={openEdit}
          onDelete={removeComplaint}
          onStatusChange={changeStatus}
          onCreateResolution={addResolution}
          onUpdateResolution={editResolution}
          onDeleteResolution={removeResolution}
          onMessageAssignee={messageAssignee}
          onMessageResident={messageResident}
          residentMessageTitle={
            resident && !resident.alimtalkOptIn
              ? "알림톡 미동의 시 SMS로 자동 전환됩니다."
              : undefined
          }
        />
      )}

      {messagingPreset && (
        <MessagingModal
          open
          preset={messagingPreset}
          onClose={() => setMessagingPreset(null)}
          onSent={(result) => {
            toast.success(
              messagingPreset.context === "A/S 확인"
                ? `문자가 발송되었습니다. (성공 ${result.count}건)`
                : `입주자 안내 ${result.count}건 발송을 접수했습니다.`,
            );
            setMessagingPreset(null);
          }}
        />
      )}
    </Panel>
  );
}
