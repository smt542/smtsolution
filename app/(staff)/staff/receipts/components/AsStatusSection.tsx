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
  COMPLAINT_STATUS_STYLE,
  formatComplaintDate,
  formatUnitLabel,
} from "../constants";
import type { ResolutionDraft } from "./AsComplaintForm";
import { ComplaintDetailModal } from "./ComplaintDetailModal";
import { ComplaintFormModal } from "./ComplaintFormModal";

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
      closeForm();
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
      setSelectedId(null);
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
      <Button type="button" onClick={() => setFormOpen(true)} disabled={buildingId === null}>
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
                const latest = complaint.resolutions[0];
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
                      <Badge className={`px-2 py-1 ${COMPLAINT_STATUS_STYLE[complaint.status]}`}>
                        {COMPLAINT_STATUS_LABEL[complaint.status]}
                      </Badge>
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-3 text-t2">
                      {latest?.resultContent ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-t2">
                      {formatComplaintDate(latest?.resolvedAt ?? complaint.completedAt)}
                    </td>
                    <td className="px-3 py-3 text-t2">{complaint.reporterName ?? "-"}</td>
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
