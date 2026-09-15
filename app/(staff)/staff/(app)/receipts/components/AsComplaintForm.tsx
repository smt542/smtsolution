"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Select, Spinner, Textarea } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  complaintFormSchema,
  type ComplaintFormInput,
  type ComplaintFormValues,
} from "@/components/forms/schema/complaint";
import type { Account } from "@/hooks/reactquery/accounts";
import type { AsCategory } from "@/hooks/reactquery/asCategories";
import type { Building } from "@/hooks/reactquery/buildings";
import type { Complaint, ComplaintInput } from "@/hooks/reactquery/complaints";
import { useOccupancies } from "@/hooks/reactquery/occupancies";
import { useUnits } from "@/hooks/reactquery/units";
import { COMPLAINT_STATUS_OPTIONS, formatUnitLabel, startOfDayIso } from "../constants";
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

function defaultsFor(editing: Complaint | null): ComplaintFormInput {
  const resolution = editing?.resolutions?.[0] ?? null;
  return {
    buildingId: editing ? String(editing.buildingId) : "",
    unitId: editing?.unitId ? String(editing.unitId) : "",
    reporterName: editing?.reporterName ?? "",
    assignedTo: editing?.assignedTo ?? "",
    receivedDate: editing ? toDateInput(editing.receivedAt) : todayInput(),
    categoryId: editing?.categoryId ? String(editing.categoryId) : "",
    reporterPhone: editing?.reporterPhone ?? "",
    content: editing?.content ?? "",
    status: editing?.status ?? "",
    resolvedDate: toDateInput(resolution?.resolvedAt),
    resolvedTime: toTimeInput(resolution?.resolvedAt),
    resultContent: resolution?.resultContent ?? "",
  };
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
  const defaults = useMemo(() => defaultsFor(editing), [editing]);
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, dirtyFields, isSubmitting },
  } = useForm<ComplaintFormInput, unknown, ComplaintFormValues>({
    resolver: zodResolver(complaintFormSchema),
    defaultValues: defaults,
    shouldFocusError: true,
  });
  const buildingValue = useWatch({ control, name: "buildingId" });
  const unitValue = useWatch({ control, name: "unitId" });
  const selectedBuildingId = Number(buildingValue) || 0;
  const selectedUnitId = Number(unitValue) || 0;
  const { data: units = [], isLoading: unitsLoading } = useUnits(selectedBuildingId);
  const { data: occupancies = [] } = useOccupancies(selectedUnitId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const submitting = isPending || isSubmitting;

  const currentOccupancy = selectedUnitId
    ? occupancies.find((occupancy) => occupancy.status === "occupied") ?? occupancies[0]
    : undefined;

  useEffect(() => {
    if (open) reset(defaults);
  }, [defaults, open, reset]);

  useEffect(() => {
    if (mode !== "create" || !currentOccupancy) return;
    if (!dirtyFields.reporterName) {
      setValue("reporterName", currentOccupancy.tenantName ?? "", { shouldDirty: false });
    }
    if (!dirtyFields.reporterPhone) {
      setValue("reporterPhone", currentOccupancy.phone ?? "", { shouldDirty: false });
    }
  }, [currentOccupancy, dirtyFields.reporterName, dirtyFields.reporterPhone, mode, setValue]);

  const unitOptions = useMemo(
    () => [
      { value: "", label: selectedBuildingId ? "호수 선택" : "건물 먼저 선택" },
      ...units.map((unit) => ({ value: String(unit.id), label: formatUnitLabel(unit) })),
    ],
    [selectedBuildingId, units],
  );
  const buildingField = register("buildingId");
  const unitField = register("unitId");
  const closeSafely = () => {
    if (!submitting) onClose();
  };

  const submit = async (values: ComplaintFormValues) => {
    if (!orgId) {
      setError("root.server", { type: "server", message: "인증 정보를 확인할 수 없습니다." });
      return;
    }

    const resolvedAt = values.resolvedDate
      ? new Date(`${values.resolvedDate}T${values.resolvedTime ?? "00:00"}:00+09:00`).toISOString()
      : null;
    const resolution: ResolutionDraft | null = values.resultContent || values.resolvedDate
      ? { resultContent: values.resultContent ?? "", resolvedAt }
      : null;
    const input: ComplaintInput = {
      orgId,
      buildingId: values.buildingId,
      unitId: values.unitId,
      categoryId: values.categoryId,
      title: values.content.split("\n")[0].slice(0, 60) || "A/S 접수",
      content: values.content,
      status: values.status,
      reporterName: values.reporterName,
      reporterPhone: values.reporterPhone,
      assignedTo: values.assignedTo,
      receivedAt: startOfDayIso(values.receivedDate),
      completedAt: values.status === "completed"
        ? editing?.completedAt ?? resolvedAt ?? new Date().toISOString()
        : null,
    };

    try {
      await onSubmit(input, resolution);
      reset(defaults);
      onClose();
    } catch (error) {
      setSubmissionError(error, setError, "A/S 접수를 저장하지 못했습니다.");
    }
  };

  const footer = mode === "create" ? (
    <div className="flex justify-end">
      <Button type="submit" form={formId} disabled={submitting}>{submitting ? "추가 중…" : "추가"}</Button>
    </div>
  ) : (
    <div className="flex items-center justify-between gap-2">
      {confirmDelete ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="danger" disabled={submitting} onClick={() => editing && void onDelete?.(editing)}>삭제 확인</Button>
          <Button type="button" variant="ghost" disabled={submitting} onClick={() => setConfirmDelete(false)}>취소</Button>
        </div>
      ) : (
        <Button type="button" variant="danger" disabled={submitting} onClick={() => setConfirmDelete(true)}>삭제</Button>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" disabled={submitting} onClick={() => editing && onSendMessage?.(editing)}>확인문자 보내기</Button>
        <Button type="submit" form={formId} disabled={submitting}>{submitting ? "저장 중…" : "저장"}</Button>
      </div>
    </div>
  );

  return (
    <ComplaintDialog open={open} onClose={closeSafely} title={mode === "create" ? "A/S 접수 추가" : "A/S 접수 상세"} size="medium" footer={footer}>
      <form id={formId} className="grid grid-cols-1 gap-4 sm:grid-cols-3" onSubmit={handleSubmit(submit)} noValidate>
        <FormField htmlFor={`${formId}-building`} label={<>건물 <span className="text-red">*</span></>} error={errors.buildingId?.message} className="space-y-2 text-sm font-bold text-t2">
          <Select id={`${formId}-building`} aria-label="건물" {...buildingField} onChange={(event) => {
            void buildingField.onChange(event);
            setValue("unitId", "", { shouldDirty: true });
            setValue("reporterName", "", { shouldDirty: false });
            setValue("reporterPhone", "", { shouldDirty: false });
          }} options={[{ value: "", label: "건물 선택" }, ...buildings.map((building) => ({ value: String(building.id), label: building.name }))]} />
        </FormField>

        <FormField htmlFor={`${formId}-unit`} label={<>호수 <span className="text-red">*</span></>} error={errors.unitId?.message} className="space-y-2 text-sm font-bold text-t2">
          {unitsLoading ? <div className="flex h-11 items-center"><Spinner /></div> : (
            <Select id={`${formId}-unit`} aria-label="호수" {...unitField} disabled={!selectedBuildingId} onChange={(event) => {
              void unitField.onChange(event);
              setValue("reporterName", "", { shouldDirty: false });
              setValue("reporterPhone", "", { shouldDirty: false });
            }} options={unitOptions} />
          )}
        </FormField>

        <FormField htmlFor={`${formId}-reporter`} label="접수자" error={errors.reporterName?.message} className="space-y-2 text-sm font-bold text-t2">
          <Input id={`${formId}-reporter`} aria-label="접수자" {...register("reporterName")} placeholder="접수자 이름" />
        </FormField>
        <FormField htmlFor={`${formId}-assignee`} label="담당자" error={errors.assignedTo?.message} className="space-y-2 text-sm font-bold text-t2">
          <Select id={`${formId}-assignee`} aria-label="담당자" {...register("assignedTo")} options={[{ value: "", label: "담당자 선택" }, ...assignees.map((account) => ({ value: account.userId, label: account.affiliation ? `${account.fullName} · ${account.affiliation}` : account.fullName }))]} />
        </FormField>
        <FormField htmlFor={`${formId}-received`} label={<>접수일시 <span className="text-red">*</span></>} error={errors.receivedDate?.message} className="space-y-2 text-sm font-bold text-t2">
          <Input id={`${formId}-received`} aria-label="접수일시" type="date" {...register("receivedDate")} />
        </FormField>
        <FormField htmlFor={`${formId}-category`} label={<>유형 <span className="text-red">*</span></>} error={errors.categoryId?.message} className="space-y-2 text-sm font-bold text-t2">
          <Select id={`${formId}-category`} aria-label="유형" {...register("categoryId")} options={[{ value: "", label: "유형 선택" }, ...categories.map((category) => ({ value: String(category.id), label: category.label }))]} />
        </FormField>
        <FormField htmlFor={`${formId}-phone`} label="입주자 전화번호" error={errors.reporterPhone?.message} className="space-y-2 text-sm font-bold text-t2">
          <Input id={`${formId}-phone`} aria-label="입주자 전화번호" {...register("reporterPhone")} placeholder="010-0000-0000" />
        </FormField>
        <FormField htmlFor={`${formId}-content`} label={<>접수내용 <span className="text-red">*</span></>} error={errors.content?.message} className="space-y-2 text-sm font-bold text-t2 sm:col-span-3">
          <Textarea id={`${formId}-content`} aria-label="접수내용" {...register("content")} rows={3} placeholder="접수내용을 입력해 주세요" className="resize-y" />
        </FormField>
        <FormField htmlFor={`${formId}-status`} label="처리결과" error={errors.status?.message} className="space-y-2 text-sm font-bold text-t2">
          <Select id={`${formId}-status`} aria-label="처리결과" {...register("status")} options={[{ value: "", label: "결과 선택" }, ...COMPLAINT_STATUS_OPTIONS]} />
        </FormField>
        <FormField htmlFor={`${formId}-resolved-date`} label="시행일자" error={errors.resolvedDate?.message} className="space-y-2 text-sm font-bold text-t2">
          <Input id={`${formId}-resolved-date`} aria-label="시행일자" type="date" {...register("resolvedDate")} />
        </FormField>
        <FormField htmlFor={`${formId}-resolved-time`} label="시간" error={errors.resolvedTime?.message} className="space-y-2 text-sm font-bold text-t2">
          <Input id={`${formId}-resolved-time`} aria-label="시간" type="time" {...register("resolvedTime")} />
        </FormField>
        <FormField htmlFor={`${formId}-result`} label="처리결과 내용" error={errors.resultContent?.message} className="space-y-2 text-sm font-bold text-t2 sm:col-span-3">
          <Textarea id={`${formId}-result`} aria-label="처리결과 내용" {...register("resultContent")} rows={3} placeholder="처리결과 내용을 입력해 주세요" className="resize-y" />
        </FormField>
        {errors.root?.server?.message && <p role="alert" className="text-sm font-semibold text-red sm:col-span-3">{errors.root.server.message}</p>}
      </form>
    </ComplaintDialog>
  );
}
