"use client";

import { useMemo, useState } from "react";
import { Button, Input, Select, Spinner } from "@/components/common";
import type { Account } from "@/hooks/reactquery/accounts";
import type { AsCategory } from "@/hooks/reactquery/asCategories";
import type { Building } from "@/hooks/reactquery/buildings";
import type {
  Complaint,
  ComplaintInput,
  ComplaintStatus,
} from "@/hooks/reactquery/complaints";
import { useOccupancies } from "@/hooks/reactquery/occupancies";
import { useUnits } from "@/hooks/reactquery/units";
import { COMPLAINT_STATUS_OPTIONS, formatUnitLabel } from "../constants";
import { ComplaintDialog } from "./ComplaintDialog";

function toLocalDateTime(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

interface ComplaintFormModalProps {
  open: boolean;
  editing: Complaint | null;
  orgId?: number;
  buildings: Building[];
  categories: AsCategory[];
  assignees: Account[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: ComplaintInput) => Promise<void>;
}

export function ComplaintFormModal({
  open,
  editing,
  orgId,
  buildings,
  categories,
  assignees,
  isPending,
  onClose,
  onSubmit,
}: ComplaintFormModalProps) {
  const [buildingId, setBuildingId] = useState(
    editing ? String(editing.buildingId) : "",
  );
  const [unitId, setUnitId] = useState(editing?.unitId ? String(editing.unitId) : "");
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ? String(editing.categoryId) : "",
  );
  const [title, setTitle] = useState(editing?.title ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [status, setStatus] = useState<ComplaintStatus>(editing?.status ?? "pending");
  const [reporterNameOverride, setReporterNameOverride] = useState<string | null>(
    editing?.reporterName ?? null,
  );
  const [reporterPhoneOverride, setReporterPhoneOverride] = useState<string | null>(
    editing?.reporterPhone ?? null,
  );
  const [assignedTo, setAssignedTo] = useState(editing?.assignedTo ?? "");
  const [receivedAt, setReceivedAt] = useState(toLocalDateTime(editing?.receivedAt));
  const [error, setError] = useState("");

  const selectedBuildingId = Number(buildingId) || 0;
  const selectedUnitId = Number(unitId) || 0;
  const { data: units = [], isLoading: unitsLoading } = useUnits(selectedBuildingId);
  const { data: occupancies = [] } = useOccupancies(selectedUnitId);

  const currentOccupancy = selectedUnitId
    ? occupancies.find((occupancy) => occupancy.status === "occupied") ?? occupancies[0]
    : undefined;
  const reporterName = reporterNameOverride ?? currentOccupancy?.tenantName ?? "";
  const reporterPhone = reporterPhoneOverride ?? currentOccupancy?.phone ?? "";

  const unitOptions = useMemo(
    () => [
      { value: "", label: selectedBuildingId ? "공용·호실 미지정" : "건물을 먼저 선택하세요" },
      ...units.map((unit) => ({ value: String(unit.id), label: formatUnitLabel(unit) })),
    ],
    [selectedBuildingId, units],
  );

  const handleBuildingChange = (nextBuildingId: string) => {
    setBuildingId(nextBuildingId);
    setUnitId("");
    setReporterNameOverride(null);
    setReporterPhoneOverride(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId) {
      setError("인증 정보를 확인할 수 없습니다.");
      return;
    }
    const receivedDate = new Date(receivedAt);
    if (
      !selectedBuildingId ||
      !title.trim() ||
      !content.trim() ||
      !receivedAt ||
      Number.isNaN(receivedDate.getTime())
    ) {
      setError("건물, 제목, 접수내용, 접수일시는 필수입니다.");
      return;
    }

    setError("");
    await onSubmit({
      orgId,
      buildingId: selectedBuildingId,
      unitId: selectedUnitId || null,
      categoryId: Number(categoryId) || null,
      title: title.trim(),
      content: content.trim(),
      status,
      reporterName: reporterName.trim() || null,
      reporterPhone: reporterPhone.trim() || null,
      assignedTo: assignedTo || null,
      receivedAt: receivedDate.toISOString(),
      completedAt:
        status === "completed" ? editing?.completedAt ?? new Date().toISOString() : null,
    });
  };

  return (
    <ComplaintDialog
      open={open}
      onClose={onClose}
      title={editing ? "민원·AS 접수 수정" : "신규 민원·AS 접수"}
      size="medium"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-bold text-t2">
            건물 <span className="text-red">*</span>
            <Select
              aria-label="건물"
              value={buildingId}
              onChange={(event) => handleBuildingChange(event.target.value)}
              options={[
                { value: "", label: "건물 선택" },
                ...buildings.map((building) => ({
                  value: String(building.id),
                  label: building.name,
                })),
              ]}
            />
          </label>
          <label className="space-y-2 text-sm font-bold text-t2">
            호실
            {unitsLoading ? (
              <div className="h-11"><Spinner /></div>
            ) : (
              <Select
              aria-label="호실"
              value={unitId}
              disabled={!selectedBuildingId}
                onChange={(event) => {
                  setUnitId(event.target.value);
                  setReporterNameOverride(null);
                  setReporterPhoneOverride(null);
                }}
                options={unitOptions}
              />
            )}
          </label>
          <label className="space-y-2 text-sm font-bold text-t2">
            AS 구분
            <Select
              aria-label="AS 구분"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              options={[
                { value: "", label: "구분 없음" },
                ...categories.map((category) => ({
                  value: String(category.id),
                  label: category.label,
                })),
              ]}
            />
          </label>
          <label className="space-y-2 text-sm font-bold text-t2">
            상태
            <Select
              aria-label="상태"
              value={status}
              onChange={(event) => setStatus(event.target.value as ComplaintStatus)}
              options={COMPLAINT_STATUS_OPTIONS}
            />
          </label>
          <label className="space-y-2 text-sm font-bold text-t2">
            신고자 이름
            <Input
              aria-label="신고자 이름"
              value={reporterName}
              onChange={(event) => setReporterNameOverride(event.target.value)}
              placeholder="호실 선택 시 입주자 정보 자동 입력"
            />
          </label>
          <label className="space-y-2 text-sm font-bold text-t2">
            신고자 연락처
            <Input
              aria-label="신고자 연락처"
              value={reporterPhone}
              onChange={(event) => setReporterPhoneOverride(event.target.value)}
              placeholder="010-0000-0000"
            />
          </label>
          <label className="space-y-2 text-sm font-bold text-t2">
            담당 기사
            <Select
              aria-label="담당 기사"
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              options={[
                { value: "", label: "미배정" },
                ...assignees.map((account) => ({
                  value: account.userId,
                  label: account.affiliation
                    ? `${account.fullName} · ${account.affiliation}`
                    : account.fullName,
                })),
              ]}
            />
          </label>
          <label className="space-y-2 text-sm font-bold text-t2">
            접수일시
            <Input
              aria-label="접수일시"
              type="datetime-local"
              required
              value={receivedAt}
              onChange={(event) => setReceivedAt(event.target.value)}
            />
          </label>
        </div>

        <label className="block space-y-2 text-sm font-bold text-t2">
          제목 <span className="text-red">*</span>
          <Input
            aria-label="제목"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: 욕실 수전 누수"
          />
        </label>

        <label className="block space-y-2 text-sm font-bold text-t2">
          접수내용 <span className="text-red">*</span>
          <textarea
            aria-label="접수내용"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={5}
            placeholder="현상과 요청사항을 구체적으로 입력해 주세요."
            className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
          />
        </label>

        {error && <p role="alert" className="text-sm font-semibold text-red">{error}</p>}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </ComplaintDialog>
  );
}
