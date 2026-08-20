"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, Panel, Select, Spinner } from "@/components/common";
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

/**
 * A/S(민원) 현황·접수 — 세대 스코프. 기존 민원 CRUD 컴포넌트를 재사용.
 * P2에서 확인문자를 상세폼 단문 방식으로 단일화 예정.
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

  const action = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-line p-0.5 text-xs font-bold">
        <button
          type="button"
          onClick={() => setScope("unit")}
          disabled={unitId === null}
          className={`rounded-md px-2 py-1 disabled:opacity-40 ${
            scope === "unit" ? "bg-blue text-white" : "text-t3"
          }`}
        >
          호실
        </button>
        <button
          type="button"
          onClick={() => setScope("building")}
          className={`rounded-md px-2 py-1 ${
            scope === "building" ? "bg-blue text-white" : "text-t3"
          }`}
        >
          건물 전체
        </button>
      </div>
      <Select
        aria-label="처리결과 필터"
        value={resultFilter}
        onChange={(event) => setResultFilter(event.target.value as "" | ComplaintStatus)}
        options={[{ value: "", label: "전체" }, ...COMPLAINT_STATUS_OPTIONS]}
      />
      <Button type="button" onClick={openCreate} disabled={buildingId === null}>
        + 접수 추가
      </Button>
    </div>
  );

  return (
    <Panel title="A/S 현황" action={action}>
      {buildingId === null ? (
        <p className="py-10 text-center text-sm text-t4">건물·호실을 선택하면 A/S 현황이 표시돼요</p>
      ) : isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState message="접수된 A/S가 없습니다" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-line bg-bg text-left text-xs font-bold text-t3">
                <th className="px-3 py-2 text-right">No</th>
                <th className="px-3 py-2">호수</th>
                <th className="px-3 py-2">접수일시</th>
                <th className="px-3 py-2">유형</th>
                <th className="px-3 py-2">접수내용</th>
                <th className="px-3 py-2">전화번호</th>
                <th className="px-3 py-2">처리결과</th>
                <th className="px-3 py-2">처리결과 내용</th>
                <th className="px-3 py-2">시행일자</th>
                <th className="px-3 py-2">접수자</th>
                <th className="px-3 py-2">담당자</th>
              </tr>
            </thead>
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
                      {formatUnitLabel({ unitNo: complaint.unitNo, dong: complaint.unitDong })}
                    </td>
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
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${COMPLAINT_STATUS_STYLE[complaint.status]}`}
                      >
                        {COMPLAINT_STATUS_LABEL[complaint.status]}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-3 text-t2">
                      {latest?.resultContent ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-t2">
                      {formatComplaintDate(complaint.completedAt)}
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
