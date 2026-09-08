"use client";

import { useId, useMemo, useState } from "react";
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
import {
  COMPLAINT_STATUS_OPTIONS,
  formatUnitLabel,
  startOfDayIso,
} from "../constants";
import { ComplaintDialog } from "./ComplaintDialog";

export interface ResolutionDraft {
  resultContent: string;
  resolvedAt: string | null;
}

interface AsComplaintFormProps {
  open: boolean;
  mode: "create" | "detail";
  editing: Complaint | null;
  orgId?: number;
  buildings: Building[];
  categories: AsCategory[];
  assignees: Account[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: ComplaintInput, resolution: ResolutionDraft | null) => Promise<void>;
  onDelete?: (complaint: Complaint) => void | Promise<void>;
  onSendMessage?: (complaint: Complaint) => void;
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function toTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(11, 16);
}

function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function AsComplaintForm({
  open,
  mode,
  editing,
  orgId,
  buildings,
  categories,
  assignees,
  isPending,
  onClose,
  onSubmit,
  onDelete,
  onSendMessage,
}: AsComplaintFormProps) {
  const formId = useId();
  const latestResolution = editing?.resolutions?.[0] ?? null;

  const [buildingId, setBuildingId] = useState(editing ? String(editing.buildingId) : "");
  const [unitId, setUnitId] = useState(editing?.unitId ? String(editing.unitId) : "");
  const [reporterNameOverride, setReporterNameOverride] = useState<string | null>(
    editing?.reporterName ?? null,
  );
  const [reporterPhoneOverride, setReporterPhoneOverride] = useState<string | null>(
    editing?.reporterPhone ?? null,
  );
  const [assignedTo, setAssignedTo] = useState(editing?.assignedTo ?? "");
  const [receivedDate, setReceivedDate] = useState(
    editing ? toDateInput(editing.receivedAt) : todayInput(),
  );
  const [categoryId, setCategoryId] = useState(
    editing?.categoryId ? String(editing.categoryId) : "",
  );
  const [content, setContent] = useState(editing?.content ?? "");
  const [status, setStatus] = useState<ComplaintStatus | "">(editing?.status ?? "");
  const [resolvedDate, setResolvedDate] = useState(toDateInput(latestResolution?.resolvedAt));
  const [resolvedTime, setResolvedTime] = useState(toTimeInput(latestResolution?.resolvedAt));
  const [resultContent, setResultContent] = useState(latestResolution?.resultContent ?? "");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedBuildingId = Number(buildingId) || 0;
  const selectedUnitId = Number(unitId) || 0;
  const { data: units = [], isLoading: unitsLoading } = useUnits(selectedBuildingId);
  const { data: occupancies = [] } = useOccupancies(selectedUnitId);

  const currentOccupancy = selectedUnitId
    ? occupancies.find((occupancy) => occupancy.status === "occupied") ?? occupancies[0]
    : undefined;

  // 생성 모드에서만 호실의 입주자 정보를 자동 채움(수동 편집 시 override로 고정).
  const autoName = mode === "create" ? currentOccupancy?.tenantName ?? "" : "";
  const autoPhone = mode === "create" ? currentOccupancy?.phone ?? "" : "";
  const reporterName = reporterNameOverride ?? autoName;
  const reporterPhone = reporterPhoneOverride ?? autoPhone;

  const unitOptions = useMemo(
    () => [
      { value: "", label: selectedBuildingId ? "호수 선택" : "건물 먼저 선택" },
      ...units.map((unit) => ({ value: String(unit.id), label: formatUnitLabel(unit) })),
    ],
    [selectedBuildingId, units],
  );

  const handleBuildingChange = (next: string) => {
    setBuildingId(next);
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
    if (!selectedBuildingId || !selectedUnitId || !categoryId || !receivedDate || !content.trim()) {
      setError("건물, 호수, 유형, 접수일시, 접수내용은 필수입니다.");
      return;
    }
    setError("");

    const nextStatus: ComplaintStatus = status || "pending";
    const resolvedAt =
      resolvedDate
        ? new Date(`${resolvedDate}T${resolvedTime || "00:00"}:00+09:00`).toISOString()
        : null;
    const resolution: ResolutionDraft | null =
      resultContent.trim() || resolvedDate
        ? { resultContent: resultContent.trim(), resolvedAt }
        : null;

    const input: ComplaintInput = {
      orgId,
      buildingId: selectedBuildingId,
      unitId: selectedUnitId,
      categoryId: Number(categoryId) || null,
      title: content.trim().split("\n")[0].slice(0, 60) || "A/S 접수",
      content: content.trim(),
      status: nextStatus,
      reporterName: reporterName.trim() || null,
      reporterPhone: reporterPhone.trim() || null,
      assignedTo: assignedTo || null,
      receivedAt: startOfDayIso(receivedDate),
      completedAt:
        nextStatus === "completed"
          ? editing?.completedAt ?? resolvedAt ?? new Date().toISOString()
          : null,
    };

    try {
      await onSubmit(input, resolution);
    } catch {
      // 부모에서 토스트·모달 유지 처리
    }
  };

  const footer =
    mode === "create" ? (
      <div className="flex justify-end">
        <Button type="submit" form={formId} disabled={isPending}>
          {isPending ? "처리 중…" : "추가"}
        </Button>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-2">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="danger"
              disabled={isPending}
              onClick={() => editing && void onDelete?.(editing)}
            >
              삭제 확인
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              취소
            </Button>
          </div>
        ) : (
          <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>
            삭제
          </Button>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => editing && onSendMessage?.(editing)}
          >
            확인문자 보내기
          </Button>
          <Button type="submit" form={formId} disabled={isPending}>
            {isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </div>
    );

  return (
    <ComplaintDialog
      open={open}
      onClose={onClose}
      title={mode === "create" ? "A/S 접수 추가" : "A/S 접수 상세"}
      size="medium"
      footer={footer}
    >
      <form id={formId} className="grid grid-cols-1 gap-4 sm:grid-cols-3" onSubmit={handleSubmit}>
        <label className="space-y-2 text-sm font-bold text-t2">
          건물 <span className="text-red">*</span>
          <Select
            aria-label="건물"
            value={buildingId}
            onChange={(event) => handleBuildingChange(event.target.value)}
            options={[
              { value: "", label: "건물 선택" },
              ...buildings.map((building) => ({ value: String(building.id), label: building.name })),
            ]}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-t2">
          호수 <span className="text-red">*</span>
          {unitsLoading ? (
            <div className="flex h-11 items-center"><Spinner /></div>
          ) : (
            <Select
              aria-label="호수"
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
          접수자
          <Input
            aria-label="접수자"
            value={reporterName}
            onChange={(event) => setReporterNameOverride(event.target.value)}
            placeholder="접수자 이름"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-t2">
          담당자
          <Select
            aria-label="담당자"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            options={[
              { value: "", label: "담당자 선택" },
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
          접수일시 <span className="text-red">*</span>
          <Input
            aria-label="접수일시"
            type="date"
            required
            value={receivedDate}
            onChange={(event) => setReceivedDate(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-t2">
          유형 <span className="text-red">*</span>
          <Select
            aria-label="유형"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            options={[
              { value: "", label: "유형 선택" },
              ...categories.map((category) => ({ value: String(category.id), label: category.label })),
            ]}
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-t2">
          입주자 전화번호
          <Input
            aria-label="입주자 전화번호"
            value={reporterPhone}
            onChange={(event) => setReporterPhoneOverride(event.target.value)}
            placeholder="010-0000-0000"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-t2 sm:col-span-3">
          접수내용 <span className="text-red">*</span>
          <textarea
            aria-label="접수내용"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={3}
            placeholder="접수내용을 입력해 주세요"
            className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-t2">
          처리결과
          <Select
            aria-label="처리결과"
            value={status}
            onChange={(event) => setStatus(event.target.value as ComplaintStatus | "")}
            options={[{ value: "", label: "결과 선택" }, ...COMPLAINT_STATUS_OPTIONS]}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-t2">
          시행일자
          <Input
            aria-label="시행일자"
            type="date"
            value={resolvedDate}
            onChange={(event) => setResolvedDate(event.target.value)}
          />
        </label>
        <label className="space-y-2 text-sm font-bold text-t2">
          시간
          <Input
            aria-label="시간"
            type="time"
            value={resolvedTime}
            onChange={(event) => setResolvedTime(event.target.value)}
          />
        </label>

        <label className="space-y-2 text-sm font-bold text-t2 sm:col-span-3">
          처리결과 내용
          <textarea
            aria-label="처리결과 내용"
            value={resultContent}
            onChange={(event) => setResultContent(event.target.value)}
            rows={3}
            placeholder="처리결과 내용을 입력해 주세요"
            className="w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 text-sm text-t1 placeholder:text-t4 focus:border-brand focus:outline-none"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm font-semibold text-red sm:col-span-3">
            {error}
          </p>
        )}
      </form>
    </ComplaintDialog>
  );
}
