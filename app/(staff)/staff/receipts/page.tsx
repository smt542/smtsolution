"use client";

import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, Input, SearchBar, Select, Spinner } from "@/components/common";
import { useAccounts } from "@/hooks/reactquery/accounts";
import { useAsCategories } from "@/hooks/reactquery/asCategories";
import { useMe } from "@/hooks/reactquery/auth";
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
import { hasModule } from "@/lib/auth/permissions";
import type { MessagingPreset } from "@/lib/messaging/preset";
import { MessagingModal } from "../messaging/components/MessagingModal";
import {
  COMPLAINT_STATUS_LABEL,
  COMPLAINT_STATUS_OPTIONS,
  COMPLAINT_STATUS_STYLE,
  endOfDayIso,
  startOfDayIso,
} from "./constants";
import { ComplaintDetailModal } from "./components/ComplaintDetailModal";
import { ComplaintFormModal } from "./components/ComplaintFormModal";
import { ComplaintTable } from "./components/ComplaintTable";
import { PaymentStatusSection } from "./components/PaymentStatusSection";

function ComplaintManagement({
  orgId,
  canSendMessages,
}: {
  orgId: number;
  canSendMessages: boolean;
}) {
  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [receivedTo, setReceivedTo] = useState("");
  const [statusFilters, setStatusFilters] = useState<ComplaintStatus[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Complaint | null>(null);
  const [messagingPreset, setMessagingPreset] = useState<MessagingPreset | null>(null);

  const { data: buildings = [], isLoading: isBuildingsLoading } = useBuildings();
  const { data: categories = [] } = useAsCategories();
  const { data: assignees = [] } = useAccounts({ type: "field_staff" });
  const {
    data: complaints = [],
    isLoading,
    isError,
    refetch,
  } = useComplaints({
    buildingId: Number(buildingFilter) || undefined,
    categoryId: Number(categoryFilter) || undefined,
    receivedFrom: startOfDayIso(receivedFrom),
    receivedTo: endOfDayIso(receivedTo),
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

  const filteredComplaints = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ko-KR");
    return complaints.filter((complaint) => {
      if (statusFilters.length > 0 && !statusFilters.includes(complaint.status)) return false;
      if (!normalizedSearch) return true;
      const target = [
        complaint.buildingName,
        complaint.unitDong,
        complaint.unitNo,
        complaint.categoryLabel,
        complaint.reporterName,
        complaint.reporterPhone,
        complaint.title,
        complaint.content,
        complaint.assignedTo ? assigneeNames.get(complaint.assignedTo) : "",
        ...complaint.resolutions.flatMap((resolution) => [
          resolution.resultContent,
          resolution.resultNotes,
        ]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko-KR");
      return target.includes(normalizedSearch);
    });
  }, [assigneeNames, complaints, search, statusFilters]);

  const selectedComplaint =
    complaints.find((complaint) => complaint.id === selectedId) ?? null;

  const counts = useMemo(
    () => ({
      all: complaints.length,
      pending: complaints.filter((complaint) => complaint.status === "pending").length,
      completed: complaints.filter((complaint) => complaint.status === "completed").length,
      on_hold: complaints.filter((complaint) => complaint.status === "on_hold").length,
      repeat: complaints.filter((complaint) => complaint.status === "repeat").length,
    }),
    [complaints],
  );

  const toggleStatus = (status: ComplaintStatus) => {
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    );
  };

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
    setMessagingPreset({
      context: "민원·AS 안내",
      channel: "sms",
      body: `민원·AS 안내: ${complaint.title}${complaint.content ? `\n${complaint.content}` : ""}`,
      recipients: [{
        name: assignee.fullName,
        phone: assignee.phone,
        kind: "staff",
        ref: { userId: assignee.userId },
      }],
    });
  };

  const hasFilters =
    Boolean(search || buildingFilter || categoryFilter || receivedFrom || receivedTo) ||
    statusFilters.length > 0;

  const resetFilters = () => {
    setSearch("");
    setBuildingFilter("");
    setCategoryFilter("");
    setReceivedFrom("");
    setReceivedTo("");
    setStatusFilters([]);
  };

  return (
    <div className="flex min-h-screen flex-col gap-5 p-6">
      <PaymentStatusSection
        buildings={buildings.filter((building) => building.orgId === orgId)}
        isBuildingsLoading={isBuildingsLoading}
        canSendMessages={canSendMessages}
      />

      <div className="my-2 border-t border-line" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">민원·AS 접수</h1>
          <p className="mt-1 text-sm text-t3">접수부터 담당 기사 배정과 처리이력까지 한곳에서 관리합니다.</p>
        </div>
        <Button type="button" onClick={openCreate}>+ 신규 접수</Button>
      </div>

      <section aria-label="상태별 접수 건수" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <button
          type="button"
          aria-pressed={statusFilters.length === 0}
          onClick={() => setStatusFilters([])}
          className={`rounded-2xl border p-4 text-left transition ${
            statusFilters.length === 0 ? "border-blue bg-blue-t2" : "border-line bg-surface hover:border-blue"
          }`}
        >
          <p className="text-xs font-bold text-t3">전체</p>
          <p className="mt-2 text-2xl font-extrabold text-t1 num">{counts.all}</p>
        </button>
        {COMPLAINT_STATUS_OPTIONS.map((option) => {
          const active = statusFilters.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggleStatus(option.value)}
              className={`rounded-2xl border p-4 text-left transition ${
                active ? "border-blue bg-blue-t2" : "border-line bg-surface hover:border-blue"
              }`}
            >
              <span className={`rounded-full px-2 py-1 text-xs font-bold ${COMPLAINT_STATUS_STYLE[option.value]}`}>
                {option.label}
              </span>
              <p className="mt-2 text-2xl font-extrabold text-t1 num">{counts[option.value]}</p>
            </button>
          );
        })}
      </section>

      <section aria-label="민원·AS 검색 조건" className="rounded-2xl border border-line bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_minmax(160px,1fr)_minmax(150px,1fr)_150px_150px_auto]">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="건물·호실·신고자·접수내용 검색"
          />
          <Select
            aria-label="건물 필터"
            value={buildingFilter}
            onChange={(event) => setBuildingFilter(event.target.value)}
            options={[
              { value: "", label: "전체 건물" },
              ...buildings.map((building) => ({ value: String(building.id), label: building.name })),
            ]}
          />
          <Select
            aria-label="AS 구분 필터"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            options={[
              { value: "", label: "전체 AS 구분" },
              ...categories.map((category) => ({ value: String(category.id), label: category.label })),
            ]}
          />
          <Input
            aria-label="접수 시작일"
            type="date"
            value={receivedFrom}
            max={receivedTo || undefined}
            onChange={(event) => setReceivedFrom(event.target.value)}
          />
          <Input
            aria-label="접수 종료일"
            type="date"
            value={receivedTo}
            min={receivedFrom || undefined}
            onChange={(event) => setReceivedTo(event.target.value)}
          />
          <Button type="button" variant="ghost" disabled={!hasFilters} onClick={resetFilters}>
            초기화
          </Button>
        </div>
        {statusFilters.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="text-xs font-bold text-t3">상태 복수 선택</span>
            {statusFilters.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatus(status)}
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${COMPLAINT_STATUS_STYLE[status]}`}
              >
                {COMPLAINT_STATUS_LABEL[status]} ×
              </button>
            ))}
          </div>
        )}
      </section>

      {isError ? (
        <div className="rounded-2xl border border-red/20 bg-red-t p-8 text-center">
          <p className="text-sm font-semibold text-red">목록을 불러오지 못했습니다. 다시 시도해 주세요.</p>
          <Button type="button" variant="ghost" className="mt-4" onClick={() => void refetch()}>
            다시 시도
          </Button>
        </div>
      ) : (
        <ComplaintTable
          complaints={filteredComplaints}
          assignees={assignees}
          isLoading={isLoading}
          onSelect={(complaint) => setSelectedId(complaint.id)}
        />
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

      {selectedComplaint && (
        <ComplaintDetailModal
          open
          complaint={selectedComplaint}
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
    </div>
  );
}

export default function ReceiptManagementPage() {
  const { data: me } = useMe();

  if (me === undefined) return <Spinner />;
  if (!me || !hasModule(me, "complaints")) {
    return (
      <div className="p-6">
        <EmptyState message="민원·AS 관리 권한이 없습니다" />
      </div>
    );
  }

  return (
    <Suspense fallback={<Spinner />}>
      <ComplaintManagement
        orgId={me.orgId}
        canSendMessages={hasModule(me, "messaging")}
      />
    </Suspense>
  );
}
