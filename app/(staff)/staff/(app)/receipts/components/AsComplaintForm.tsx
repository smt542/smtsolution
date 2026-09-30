"use client";

import { useEffect, useId, useMemo } from "react";
import { Controller, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, CustomDropdown, Input, PhoneInput, Textarea } from "@/components/common";
import { DateInput, TimeInput } from "@/components/common/DateInput";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { FormField } from "@/components/common/FormField";
import { useAppToast } from "@/hooks/common/useAppToast";
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

export interface ComplaintCreateDefaults {
  buildingId: number | null;
  unitId: number | "all" | null;
}

export interface ComplaintMessageDraft {
  buildingId: string;
  unitId: string;
  assignedTo: string;
  content: string;
  reporterPhone: string;
}

interface AsComplaintFormProps {
  open: boolean;
  mode: "create" | "detail";
  editing: Complaint | null;
  createDefaults?: ComplaintCreateDefaults;
  receiverName: string;
  orgId?: number;
  buildings: Building[];
  categories: AsCategory[];
  assignees: Account[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: ComplaintInput, resolution: ResolutionDraft | null) => Promise<void>;
  onDelete?: (complaint: Complaint) => void | Promise<void>;
  onSendMessage?: (complaint: Complaint, draft: ComplaintMessageDraft) => void;
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

function defaultsFor(
  editing: Complaint | null,
  createDefaults: ComplaintCreateDefaults | undefined,
  defaultAssignedTo: string,
): ComplaintFormInput {
  const resolution = editing?.resolutions?.[0] ?? null;
  return {
    buildingId: editing ? String(editing.buildingId) : String(createDefaults?.buildingId ?? ""),
    unitId: editing
      ? editing.unitId === null || editing.unitId === undefined ? "all" : String(editing.unitId)
      : createDefaults?.unitId === null || createDefaults?.unitId === undefined
        ? "all"
        : String(createDefaults.unitId),
    assignedTo: editing?.assignedTo ?? defaultAssignedTo,
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
  createDefaults,
  receiverName,
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
  const toast = useAppToast();
  const confirm = useConfirm();
  const createDefaultBuildingId = createDefaults?.buildingId;
  const createDefaultUnitId = createDefaults?.unitId;
  const defaultAssignedTo = useMemo(() => {
    if (mode !== "create") return "";
    const building = buildings.find((item) => item.id === createDefaultBuildingId);
    return building?.managerUserId && assignees.some((account) => account.userId === building.managerUserId)
      ? building.managerUserId
      : "";
  }, [assignees, buildings, createDefaultBuildingId, mode]);
  const defaults = useMemo(
    () => defaultsFor(
      editing,
      { buildingId: createDefaultBuildingId ?? null, unitId: createDefaultUnitId ?? "all" },
      defaultAssignedTo,
    ),
    [createDefaultBuildingId, createDefaultUnitId, defaultAssignedTo, editing],
  );
  const {
    register,
    control,
    handleSubmit,
    reset,
    resetField,
    setValue,
    setFocus,
    getValues,
    formState: { dirtyFields, isSubmitting },
  } = useForm<ComplaintFormInput, unknown, ComplaintFormValues>({
    resolver: zodResolver(complaintFormSchema),
    defaultValues: defaults,
    shouldFocusError: true,
  });
  const buildingValue = useWatch({ control, name: "buildingId" });
  const unitValue = useWatch({ control, name: "unitId" });
  const selectedBuildingId = Number(buildingValue) || 0;
  const selectedUnitId = unitValue === "all" ? 0 : Number(unitValue) || 0;
  const { data: units = [], isLoading: unitsLoading } = useUnits(selectedBuildingId);
  const { data: occupancies = [] } = useOccupancies(selectedUnitId);
  const submitting = isPending || isSubmitting;

  const currentOccupancy = selectedUnitId
    ? occupancies.find((occupancy) => occupancy.status === "occupied") ?? occupancies[0]
    : undefined;

  useEffect(() => {
    if (open) reset(defaults);
  }, [defaults, open, reset]);

  useEffect(() => {
    if (mode !== "create" || !currentOccupancy) return;
    if (!dirtyFields.reporterPhone) {
      setValue("reporterPhone", currentOccupancy.phone ?? "", { shouldDirty: false });
    }
  }, [currentOccupancy, dirtyFields.reporterPhone, mode, setValue]);

  const unitOptions = useMemo(
    () => [{ value: "all", label: "건물 전체" }, ...units.map((unit) => ({ value: String(unit.id), label: formatUnitLabel(unit) }))],
    [units],
  );
  const closeSafely = () => {
    if (!submitting) onClose();
  };

  const submit = async (values: ComplaintFormValues) => {
    if (!orgId) {
      toast.error("인증 정보를 확인할 수 없어요");
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
      reporterPhone: values.reporterPhone,
      assignedTo: values.assignedTo,
      receivedAt: startOfDayIso(values.receivedDate),
      completedAt: values.status === "completed"
        ? editing?.completedAt ?? resolvedAt ?? new Date().toISOString()
        : null,
    };

    try {
      await onSubmit(input, resolution);
    } catch {
      // 실패 안내는 onSubmit(AsStatusSection)이 토스트로 띄운다. 입력을 지키려고 창은 열어 둔다.
      return;
    }
    reset(defaults);
    onClose();
  };

  const onInvalid = (validationErrors: FieldErrors<ComplaintFormInput>) => {
    const fieldOrder = [
      "buildingId",
      "receivedDate",
      "categoryId",
      "content",
      "resolvedDate",
      "unitId",
    ] as const;
    const field = fieldOrder.find((name) => validationErrors[name])
      ?? Object.keys(validationErrors)[0] as keyof ComplaintFormInput | undefined;
    if (!field) return;
    const message = validationErrors[field]?.message;
    if (typeof message === "string") toast.warning(message);
    setFocus(field);
  };

  const confirmDelete = async () => {
    if (!editing || !onDelete || submitting) return;
    const confirmed = await confirm({
      title: "이 접수를 삭제할까요?",
      description: "삭제하면 되돌릴 수 없어요.",
      confirmLabel: "삭제",
      variant: "danger",
    });
    if (confirmed) await onDelete(editing);
  };

  const sendMessage = () => {
    if (!editing || !onSendMessage || submitting) return;
    const values = getValues();
    onSendMessage(editing, {
      buildingId: String(values.buildingId ?? ""),
      unitId: String(values.unitId ?? ""),
      assignedTo: String(values.assignedTo ?? ""),
      content: String(values.content ?? ""),
      reporterPhone: String(values.reporterPhone ?? ""),
    });
  };

  const footer = mode === "create" ? (
    <div className="flex items-center gap-[8px]">
      <div className="flex-1" />
      <Button size="wide" type="submit" form={formId} disabled={submitting} className="shadow-none">추가</Button>
    </div>
  ) : (
    <div className="flex items-center gap-[8px]">
      <Button type="button" variant="dangerOutline" disabled={submitting} onClick={() => void confirmDelete()}>삭제</Button>
      <div className="flex-1" />
      <Button type="button" variant="ghost" disabled={submitting} onClick={sendMessage}>확인문자 보내기</Button>
      <Button size="wide" type="submit" form={formId} disabled={submitting} className="shadow-none">저장</Button>
    </div>
  );

  return (
    <ComplaintDialog open={open} onClose={closeSafely} title={mode === "create" ? "A/S 접수 추가" : "A/S 접수 상세"} look="canon" footer={footer}>
      <form id={formId} className="grid grid-cols-3 gap-[12px]" onSubmit={handleSubmit(submit, onInvalid)} noValidate>
        <FormField htmlFor={`${formId}-building`} label={<>건물<b className="ml-[3px] font-bold text-red">*</b></>} className="flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Controller
            name="buildingId"
            control={control}
            render={({ field }) => (
              <CustomDropdown
                menuTransition
                id={`${formId}-building`}
                ariaLabel="건물"
                value={String(field.value ?? "")}
                onChange={(value) => {
                  field.onChange(value);
                  setValue("unitId", "all", { shouldDirty: true });
                  const building = buildings.find((item) => item.id === Number(value));
                  const managerUserId = building?.managerUserId && assignees.some(
                    (account) => account.userId === building.managerUserId,
                  ) ? building.managerUserId : "";
                  setValue("assignedTo", managerUserId, { shouldDirty: true });
                  resetField("reporterPhone", { defaultValue: "" });
                }}
                options={buildings.map((building) => ({ value: String(building.id), label: building.name }))}
                placeholder="건물 선택"
                size="form"
                position="fixed"
                menuAlign="end"
                menuMinWidth={132}
                variant="menu"
              />
            )}
          />
        </FormField>

        <FormField htmlFor={`${formId}-unit`} label={<>호수<b className="ml-[3px] font-bold text-red">*</b></>} className="flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Controller
            name="unitId"
            control={control}
            render={({ field }) => (
              <CustomDropdown
                menuTransition
                id={`${formId}-unit`}
                ariaLabel="호수"
                value={String(field.value ?? "")}
                onChange={(value) => {
                  field.onChange(value);
                  if (value === "all") {
                    resetField("reporterPhone", { defaultValue: "" });
                  } else if (!dirtyFields.reporterPhone) {
                    setValue("reporterPhone", "", { shouldDirty: false });
                  }
                }}
                options={unitsLoading ? [] : unitOptions}
                placeholder="호수 선택"
                disabled={!selectedBuildingId}
                size="form"
                position="fixed"
                menuAlign="end"
                menuMinWidth={132}
                variant="menu"
              />
            )}
          />
        </FormField>

        <FormField htmlFor={`${formId}-reporter`} label="접수자" className="flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Input id={`${formId}-reporter`} aria-label="접수자" size="38-13" value={receiverName || "-"} readOnly tabIndex={-1} />
        </FormField>
        <FormField htmlFor={`${formId}-assignee`} label="담당자" className="flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Controller
            name="assignedTo"
            control={control}
            render={({ field }) => (
              <CustomDropdown
                menuTransition
                id={`${formId}-assignee`}
                ariaLabel="담당자"
                value={String(field.value ?? "")}
                onChange={field.onChange}
                options={assignees.map((account) => ({ value: account.userId, label: account.fullName }))}
                placeholder="담당자 선택"
                size="form"
                position="fixed"
                menuAlign="end"
                menuMinWidth={132}
                variant="menu"
              />
            )}
          />
        </FormField>
        <FormField htmlFor={`${formId}-received`} label={<>접수일시<b className="ml-[3px] font-bold text-red">*</b></>} className="flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Controller
            name="receivedDate"
            control={control}
            render={({ field }) => (
              <DateInput
                id={`${formId}-received`}
                ariaLabel="접수일시"
                value={field.value ?? ""}
                onChange={field.onChange}
                size="38-13"
              />
            )}
          />
        </FormField>
        <FormField htmlFor={`${formId}-category`} label={<>유형<b className="ml-[3px] font-bold text-red">*</b></>} className="flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Controller
            name="categoryId"
            control={control}
            render={({ field }) => (
              <CustomDropdown
                menuTransition
                id={`${formId}-category`}
                ariaLabel="유형"
                value={String(field.value ?? "")}
                onChange={field.onChange}
                options={categories.map((category) => ({ value: String(category.id), label: category.label }))}
                placeholder="유형 선택"
                size="form"
                position="fixed"
                menuAlign="end"
                menuMinWidth={132}
                variant="menu"
              />
            )}
          />
        </FormField>
        <FormField htmlFor={`${formId}-phone`} label="입주자 전화번호" className="flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <PhoneInput id={`${formId}-phone`} aria-label="입주자 전화번호" size="38-13" {...register("reporterPhone")} />
        </FormField>
        <FormField htmlFor={`${formId}-content`} label={<>접수내용<b className="ml-[3px] font-bold text-red">*</b></>} className="col-span-3 flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Textarea id={`${formId}-content`} aria-label="접수내용" {...register("content")} variant="form" placeholder="접수내용을 입력해 주세요" />
        </FormField>
        <FormField htmlFor={`${formId}-status`} label="처리결과" className="flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <CustomDropdown
                menuTransition
                id={`${formId}-status`}
                ariaLabel="처리결과"
                value={String(field.value ?? "")}
                onChange={field.onChange}
                options={COMPLAINT_STATUS_OPTIONS}
                placeholder="결과 선택"
                size="form"
                position="fixed"
                menuAlign="end"
                menuMinWidth={132}
                variant="menu"
              />
            )}
          />
        </FormField>
        <FormField htmlFor={`${formId}-resolved-date`} label={<>시행일자<b className="ml-[3px] font-bold text-red">*</b></>} className="flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Controller
            name="resolvedDate"
            control={control}
            render={({ field }) => (
              <DateInput
                id={`${formId}-resolved-date`}
                ariaLabel="시행일자"
                value={field.value ?? ""}
                onChange={field.onChange}
                size="38-13"
              />
            )}
          />
        </FormField>
        <FormField htmlFor={`${formId}-resolved-time`} label="시간" className="flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Controller
            name="resolvedTime"
            control={control}
            render={({ field }) => (
              <TimeInput
                id={`${formId}-resolved-time`}
                ariaLabel="시간"
                value={field.value ?? ""}
                onChange={field.onChange}
                placeholder="00:00"
                size="38-13"
              />
            )}
          />
        </FormField>
        <FormField htmlFor={`${formId}-result`} label="처리결과 내용" className="col-span-3 flex min-w-0 flex-col gap-[6px]" labelClassName="block text-[12px] font-medium text-t1">
          <Textarea id={`${formId}-result`} aria-label="처리결과 내용" {...register("resultContent")} variant="form" placeholder="처리결과 내용을 입력해 주세요" />
        </FormField>
      </form>
    </ComplaintDialog>
  );
}
