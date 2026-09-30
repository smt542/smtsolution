"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import {
  Controller,
  useForm,
  type Control,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { z } from "zod";
import {
  BizRegNoInput,
  Button,
  Input,
  Modal,
  PhoneInput,
  PhotoUpload,
  SegmentedControl,
} from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import type { PhotoUploadExistingPhoto } from "@/components/common/PhotoUpload";
import { CalendarIcon } from "@/components/icons";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  orgCreateSchema,
  orgEditSchema,
  regionFromAddress,
  type OrgCreateFormValues,
  type OrgEditFormValues,
} from "@/components/forms/schema/platformOrganization";
import { appToast as toast } from "@/hooks/common/useAppToast";
import {
  removeOrganizationContractFile,
  uploadOrganizationContractFile,
  useCreatePlatformOrganization,
  useDeletePlatformOrganization,
  useOrganizationContractFilePreviews,
  usePlatformOrganizationOwner,
  usePlatformResetPassword,
  useSetOrgDeleted,
  useUpdateOrganizationStatus,
  useUpdatePlatformOrganization,
  type OrganizationStatus,
  type PlatformOrganization,
} from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";
import { MAX_ATTACHMENT_FILES } from "@/lib/attachments/policy";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { HqPasswordInput } from "../../../../_components/HqPasswordInput";

type CreateInput = z.input<typeof orgCreateSchema>;
type EditInput = z.input<typeof orgEditSchema>;
type OrganizationFormValues = CreateInput | EditInput;

type CreateProps = {
  mode: "create";
  onClose: () => void;
};

type EditProps = {
  mode: "edit";
  organization: PlatformOrganization;
  onClose: () => void;
};

export function OrgFormModal(props: CreateProps | EditProps) {
  return props.mode === "create" ? <CreateModal onClose={props.onClose} /> : <EditModal {...props} />;
}

const INPUT_CLASS = "h-[42px] rounded-[10px] px-[13px] text-[13.5px] font-semibold placeholder:font-medium focus:border-blue focus:ring-[3px] focus:ring-blue-t";
const ERROR_CLASS = "border-red ring-[3px] ring-[rgba(233,79,79,0.12)]";
// 정본 .hf-in2[readonly]: 속성 선택자로 명시도를 올려 공용 Input 기본값(bg-surface·text-t1·포커스 링)을 이긴다.
const READONLY_CLASS = "pointer-events-none [&[readonly]]:bg-bg [&[readonly]]:text-t3 [&[readonly]:focus]:border-line [&[readonly]:focus]:ring-0";
const DATE_TRIGGER_CLASS = "h-[42px] rounded-[10px] border border-line bg-surface px-[13px] text-[13.5px] font-semibold focus:border-blue focus:ring-[3px] focus:ring-blue-t flex w-full items-center justify-between gap-2 text-left";
const DATE_OPEN_CLASS = "border-blue ring-[3px] ring-blue-t";

const CREATE_DEFAULTS: CreateInput = {
  name: "",
  phone: "",
  contractStartDate: "",
  contractEndDate: "",
  representativeName: "",
  businessRegistrationNumber: "",
  fax: "",
  email: "",
  address: "",
  operatingHours: "",
  ownerUsername: "",
  ownerPassword: "",
};

const STATUS_OPTIONS = [
  { value: "operating", label: "운영" },
  { value: "suspended", label: "정지" },
  { value: "terminated", label: "해지" },
];

type EditStatus = "operating" | "suspended" | "terminated";

function statusFromOrganization(organization: PlatformOrganization): EditStatus {
  if (organization.deletedAt) return "terminated";
  return organization.status === "suspended" ? "suspended" : "operating";
}

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function datePlaceholders(): { start: string; end: string } {
  const today = new Date();
  const end = new Date(today);
  end.setFullYear(end.getFullYear() + 1);
  end.setDate(end.getDate() - 1);
  return { start: localDate(today), end: localDate(end) };
}

function storedFileName(path: string): string {
  const name = path.split("/").at(-1) ?? path;
  return name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "");
}

function fieldError<T extends FieldValues>(errors: FieldErrors<T>, name: string): boolean {
  const values = errors as unknown as Record<string, unknown>;
  return Boolean(values[name]);
}

function fieldMessage<T extends FieldValues>(errors: FieldErrors<T>, name: string): string | undefined {
  const value = (errors as unknown as Record<string, { message?: unknown }>)[name];
  return typeof value?.message === "string" ? value.message : undefined;
}

function inputClass(hasError: boolean, readOnly = false): string {
  return [INPUT_CLASS, hasError ? ERROR_CLASS : "", readOnly ? READONLY_CLASS : ""]
    .filter(Boolean)
    .join(" ");
}

function HqField({
  id,
  label,
  required = false,
  full = false,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-bold text-t2">
        {label}
        {required ? <em className="ml-[3px] not-italic text-red">*</em> : null}
      </label>
      {children}
    </div>
  );
}

function OrganizationFormFields({
  mode,
  register,
  control,
  errors,
  editStatus,
  onStatusChange,
  contractFiles,
  onContractFilesChange,
  maxNewFiles,
  existing,
  disabled,
  ownerUsername,
  ownerLoading,
  ownerAvailable,
}: {
  mode: "create" | "edit";
  register: UseFormRegister<OrganizationFormValues>;
  control: Control<OrganizationFormValues>;
  errors: FieldErrors<OrganizationFormValues>;
  editStatus?: EditStatus;
  onStatusChange?: (value: EditStatus) => void;
  contractFiles: File[];
  onContractFilesChange: (files: File[]) => void;
  /** 새로 더 고를 수 있는 장수(저장된 사진 제외) */
  maxNewFiles: number;
  existing: readonly PhotoUploadExistingPhoto[];
  disabled: boolean;
  ownerUsername?: string;
  ownerLoading?: boolean;
  ownerAvailable?: boolean;
}) {
  const placeholders = datePlaceholders();
  const registerField = (name: string) => register(name as Path<OrganizationFormValues>);
  const error = (name: string) => fieldError(errors, name);
  const dateClass = (name: string) => [DATE_TRIGGER_CLASS, error(name) ? ERROR_CLASS : ""].filter(Boolean).join(" ");

  return (
    <div className="mt-[18px] grid grid-cols-2 gap-x-[15px] gap-y-[13px]">
      {mode === "edit" && (
        <HqField label="상태" full>
          <SegmentedControl
            options={STATUS_OPTIONS}
            value={editStatus ?? "operating"}
            onChange={(value) => onStatusChange?.(value as EditStatus)}
            variant="outline"
            disabled={disabled}
          />
        </HqField>
      )}

      <HqField id="organization-contract-start" label="계약 시작일" required>
        <Controller
          control={control}
          name={"contractStartDate" as Path<OrganizationFormValues>}
          render={({ field }) => (
            <DpDatePicker
              id="organization-contract-start"
              value={String(field.value ?? "")}
              onChange={field.onChange}
              disabled={disabled}
              placeholder={placeholders.start}
              displayFormatter={(value) => value}
              triggerClassName={dateClass("contractStartDate")}
              triggerOpenClassName={DATE_OPEN_CLASS}
              endAdornment={<CalendarIcon className="size-4 shrink-0 text-t3" aria-hidden="true" />}
              className="w-full"
            />
          )}
        />
      </HqField>
      <HqField id="organization-contract-end" label="계약 만료일" required>
        <Controller
          control={control}
          name={"contractEndDate" as Path<OrganizationFormValues>}
          render={({ field }) => (
            <DpDatePicker
              id="organization-contract-end"
              value={String(field.value ?? "")}
              onChange={field.onChange}
              disabled={disabled}
              placeholder={placeholders.end}
              displayFormatter={(value) => value}
              triggerClassName={dateClass("contractEndDate")}
              triggerOpenClassName={DATE_OPEN_CLASS}
              endAdornment={<CalendarIcon className="size-4 shrink-0 text-t3" aria-hidden="true" />}
              className="w-full"
            />
          )}
        />
      </HqField>

      <div className="col-span-2 my-[3px] h-px bg-line2" />

      <HqField id="organization-name" label="상호" required full>
        <Input id="organization-name" placeholder="예) 스마일종합관리" className={inputClass(error("name"))} {...registerField("name")} />
      </HqField>
      <HqField id="organization-representative" label="대표자" required>
        <Input id="organization-representative" placeholder="예) 최서윤" className={inputClass(error("representativeName"))} {...registerField("representativeName")} />
      </HqField>
      <HqField id="organization-business-number" label="사업자등록번호" required>
        <BizRegNoInput id="organization-business-number" placeholder="000-00-00000" className={inputClass(error("businessRegistrationNumber"))} {...registerField("businessRegistrationNumber")} />
      </HqField>
      <HqField id="organization-phone" label="대표 전화" required>
        <PhoneInput id="organization-phone" placeholder="042-000-0000" className={inputClass(error("phone"))} {...registerField("phone")} />
      </HqField>
      <HqField id="organization-fax" label="팩스 번호" required>
        <PhoneInput id="organization-fax" placeholder="042-000-0000" className={inputClass(error("fax"))} {...registerField("fax")} />
      </HqField>
      <HqField id="organization-email" label="이메일" required full>
        <Input id="organization-email" type="email" placeholder="admin@company.co.kr" className={inputClass(error("email"))} {...registerField("email")} />
      </HqField>
      <HqField id="organization-address" label="주소" required full>
        <Input id="organization-address" placeholder="대전 유성구 봉명동 123-4 2층" className={inputClass(error("address"))} {...registerField("address")} />
      </HqField>
      <HqField id="organization-hours" label="운영 시간" full>
        <Input id="organization-hours" placeholder="평일 09:00 ~ 18:00" className={inputClass(error("operatingHours"))} {...registerField("operatingHours")} />
      </HqField>
      <HqField id="organization-contract-file" label="계약서 사진" full>
        <PhotoUpload
          variant="drop"
          hideLabel
          files={contractFiles}
          existing={existing}
          onFilesChange={onContractFilesChange}
          max={maxNewFiles}
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
        />
      </HqField>

      <div className="col-span-2 my-[3px] h-px bg-line2" />

      <HqField id="organization-owner-username" label="관리자 아이디" required>
        {mode === "create" ? (
          <Input id="organization-owner-username" placeholder="smile_admin" className={inputClass(error("ownerUsername"))} {...registerField("ownerUsername")} />
        ) : (
          <Input
            id="organization-owner-username"
            value={ownerLoading ? "불러오는 중…" : ownerUsername ?? "관리자 계정 없음"}
            readOnly
            className={inputClass(false, true)}
            aria-readonly="true"
          />
        )}
      </HqField>
      <HqField id="organization-owner-password" label={mode === "create" ? "초기 비밀번호" : "비밀번호"} required={mode === "create"}>
        <HqPasswordInput
          id="organization-owner-password"
          autoComplete="new-password"
          maxLength={4}
          inputMode="numeric"
          placeholder={mode === "create" ? "숫자 4자리" : "숫자 4자리 (변경할 때만)"}
          disabled={disabled || (mode === "edit" && !ownerAvailable)}
          className={inputClass(error("ownerPassword"))}
          {...registerField("ownerPassword")}
        />
      </HqField>
    </div>
  );
}

function buildValidationMessage<T extends FieldValues>(
  values: T,
  errors: FieldErrors<T>,
  mode: "create" | "edit",
): string {
  const required = [
    ["name", "상호"],
    ["representativeName", "대표자"],
    ["businessRegistrationNumber", "사업자등록번호"],
    ["phone", "대표 전화"],
    ["fax", "팩스 번호"],
    ["email", "이메일"],
    ["address", "주소"],
    ...(mode === "create" ? [["ownerUsername", "관리자 아이디"], ["ownerPassword", "비밀번호"]] : []),
    ["contractStartDate", "계약 시작일"],
    ["contractEndDate", "계약 만료일"],
  ] as const;
  const missing = required
    .filter(([name]) => !String((values as Record<string, unknown>)[name] ?? "").trim())
    .map(([, label]) => label);
  const passwordInvalid = Boolean(String((values as Record<string, unknown>).ownerPassword ?? "").trim())
    && Boolean(fieldMessage(errors, "ownerPassword"));
  if (missing.length > 0) {
    return `입력이 필요해요: ${missing.join(", ")}${passwordInvalid ? ", 비밀번호 4자리" : ""}`;
  }

  for (const [name] of required) {
    const message = fieldMessage(errors, name);
    if (message) return message;
  }
  const passwordMessage = fieldMessage(errors, "ownerPassword");
  return passwordMessage ?? "";
}

function Description({ organization }: { organization: PlatformOrganization }) {
  return <>{[organization.region, `건물 ${formatNumber(organization.buildingCount)}곳`, `세대 ${formatNumber(organization.unitCount)}`, `세입자 ${formatNumber(organization.tenantCount)}`].filter(Boolean).join(" · ")}</>;
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const confirm = useConfirm();
  const createOrg = useCreatePlatformOrganization();
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<CreateInput, unknown, OrgCreateFormValues>({
    resolver: zodResolver(orgCreateSchema),
    defaultValues: CREATE_DEFAULTS,
    shouldFocusError: false,
  });
  const submitting = isSubmitting || createOrg.isPending;

  const onValid = async (values: OrgCreateFormValues) => {
    const accepted = await confirm({
      title: `${values.name}을(를) 생성할까요?`,
      description: "입력한 정보로 테넌트가 생성되고 관리자 계정이 발급됩니다.",
      confirmLabel: "생성",
      look: "hq",
    });
    if (!accepted) return;

    const uploadedPaths: string[] = [];
    try {
      for (const file of contractFiles) uploadedPaths.push(await uploadOrganizationContractFile(file));
      await createOrg.mutateAsync({
        name: values.name,
        phone: values.phone,
        contractStartDate: values.contractStartDate,
        contractEndDate: values.contractEndDate,
        representativeName: values.representativeName,
        businessRegistrationNumber: values.businessRegistrationNumber,
        fax: values.fax,
        email: values.email,
        address: values.address,
        region: regionFromAddress(values.address),
        operatingHours: values.operatingHours || null,
        contractFilePaths: uploadedPaths,
        owner: { username: values.ownerUsername, password: values.ownerPassword },
      });
      toast.success("테넌트를 생성했어요 · 관리자 계정 발급 완료");
      onClose();
    } catch (error) {
      await Promise.all(uploadedPaths.map((path) => removeOrganizationContractFile(path).catch(() => undefined)));
      setSubmissionError(error, setError, "테넌트 생성에 실패했습니다.");
      toast.error(error, "테넌트 생성에 실패했습니다.");
    }
  };

  const onInvalid = (fieldErrors: FieldErrors<CreateInput>) => {
    setError("root.validation", {
      type: "validation",
      message: buildValidationMessage(getValues(), fieldErrors, "create"),
    });
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!submitting) onClose();
      }}
      title="신규 테넌트 생성"
      className="flex max-h-[88vh] max-w-[min(520px,90%)] flex-col rounded-[20px] px-0 pb-5 pt-6 leading-[normal] shadow-hf-modal [&>h2]:px-6 [&>h2]:text-[17px] [&>h2]:leading-[normal] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <p className="mt-[7px] px-6 text-[13px] font-semibold leading-[1.55] text-t3">
        생성하면 입력한 정보로 관리자 계정이 발급됩니다.
      </p>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onChange={() => clearErrors("root")}
        onSubmit={handleSubmit(onValid, onInvalid)}
      >
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-1">
          <OrganizationFormFields
            mode="create"
            register={register as unknown as UseFormRegister<OrganizationFormValues>}
            control={control as unknown as Control<OrganizationFormValues>}
            errors={errors as unknown as FieldErrors<OrganizationFormValues>}
            contractFiles={contractFiles}
            onContractFilesChange={setContractFiles}
            maxNewFiles={MAX_ATTACHMENT_FILES}
            existing={[]}
            disabled={submitting}
          />
          {(errors.root?.validation?.message || errors.root?.server?.message) && (
            <div className="mt-3 rounded-[11px] border border-[rgba(233,79,79,0.22)] bg-[rgba(233,79,79,0.07)] px-[14px] py-[11px] text-[12.5px] font-bold leading-[1.5] text-red" role="alert">
              {errors.root.validation?.message ?? errors.root.server?.message}
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2 border-t border-line2 px-6 pt-4">
          <div className="flex-1" />
          <Button type="button" size="std" variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" size="std" variant="primary" className="border border-transparent" disabled={submitting}>생성</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({ organization, onClose }: Omit<EditProps, "mode">) {
  const confirm = useConfirm();
  const ownerQuery = usePlatformOrganizationOwner(organization.id);
  const updateOrg = useUpdatePlatformOrganization();
  const updateStatus = useUpdateOrganizationStatus();
  const setDeleted = useSetOrgDeleted();
  const resetPassword = usePlatformResetPassword();
  const deleteOrg = useDeletePlatformOrganization();
  const [contractFiles, setContractFiles] = useState<File[]>([]);
  // 저장된 계약서 사진 중 이번에 지운 것(저장할 때 반영)
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<EditStatus>(() => statusFromOrganization(organization));
  // 삭제 확인창이 떠 있는 동안 Esc가 이 모달까지 닫지 않게 막는다(저장 확인창은 isSubmitting이 막는다).
  const [deleting, setDeleting] = useState(false);
  const defaultValues: EditInput = useMemo(() => ({
    name: organization.name,
    phone: organization.phone ?? "",
    contractStartDate: organization.contractStartDate ?? "",
    contractEndDate: organization.contractEndDate ?? "",
    representativeName: organization.representativeName ?? "",
    businessRegistrationNumber: organization.businessRegistrationNumber ?? "",
    fax: organization.fax ?? "",
    email: organization.email ?? "",
    address: organization.address ?? "",
    operatingHours: organization.operatingHours ?? "",
    ownerPassword: "",
  }), [organization]);
  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<EditInput, unknown, OrgEditFormValues>({
    resolver: zodResolver(orgEditSchema),
    defaultValues,
    shouldFocusError: false,
  });
  const submitting = isSubmitting || deleting || updateOrg.isPending || updateStatus.isPending || setDeleted.isPending || resetPassword.isPending || deleteOrg.isPending;
  const savedPaths = organization.contractFilePaths;
  const keptPaths = savedPaths.filter((path) => !removedPaths.includes(path));
  const previews = useOrganizationContractFilePreviews(keptPaths);
  const existing: readonly PhotoUploadExistingPhoto[] = keptPaths.map((path, index) => ({
    id: path,
    name: storedFileName(path),
    url: previews[index]?.data,
    error: previews[index]?.isError,
    onDelete: () => setRemovedPaths((current) => [...current, path]),
  }));

  const onValid = async (values: OrgEditFormValues) => {
    const statusChangedToRestricted = editStatus !== statusFromOrganization(organization)
      && (editStatus === "suspended" || editStatus === "terminated");
    const accepted = await confirm({
      title: `${values.name} 정보를 저장할까요?`,
      description: statusChangedToRestricted ? (
        <>상태가 <b className="font-bold text-red">{editStatus === "suspended" ? "정지" : "해지"}</b>로 바뀌면 해당 업체의 사무·현장 관리자와 세입자 앱 접속이 제한됩니다.</>
      ) : "변경한 업체 정보와 계약 기간이 저장됩니다.",
      confirmLabel: "저장",
      look: "hq",
    });
    if (!accepted) return;

    const uploadedPaths: string[] = [];
    let organizationUpdated = false;
    try {
      for (const file of contractFiles) uploadedPaths.push(await uploadOrganizationContractFile(file, organization.id));
      const nextContractFilePaths = [...keptPaths, ...uploadedPaths];
      await updateOrg.mutateAsync({
        id: organization.id,
        input: {
          name: values.name,
          slug: organization.slug ?? "",
          phone: values.phone,
          contractStartDate: values.contractStartDate,
          contractEndDate: values.contractEndDate,
          representativeName: values.representativeName,
          businessRegistrationNumber: values.businessRegistrationNumber,
          fax: values.fax,
          email: values.email,
          address: values.address,
          region: regionFromAddress(values.address),
          operatingHours: values.operatingHours || null,
          contractFilePaths: nextContractFilePaths,
        },
      });
      organizationUpdated = true;

      if (editStatus === "terminated" && !organization.deletedAt) {
        await setDeleted.mutateAsync({ id: organization.id, deleted: true });
      } else if (editStatus !== "terminated" && organization.deletedAt) {
        await setDeleted.mutateAsync({ id: organization.id, deleted: false });
      }
      if (editStatus !== "terminated") {
        const nextStatus: OrganizationStatus = editStatus === "suspended" ? "suspended" : "active";
        if (nextStatus !== organization.status) {
          await updateStatus.mutateAsync({ id: organization.id, status: nextStatus });
        }
      }
      if (values.ownerPassword && ownerQuery.data) {
        await resetPassword.mutateAsync({ userId: ownerQuery.data.userId, password: values.ownerPassword });
      }
      const removedFiles = savedPaths.filter((path) => !nextContractFilePaths.includes(path));
      if (removedFiles.length > 0) {
        await Promise.all(removedFiles.map((path) => removeOrganizationContractFile(path))).catch(() => {
          toast.warning("이전 계약서 파일 정리가 필요합니다.");
        });
      }
      toast.success("저장했어요");
      onClose();
    } catch (error) {
      if (!organizationUpdated) {
        await Promise.all(uploadedPaths.map((path) => removeOrganizationContractFile(path).catch(() => undefined)));
      }
      setSubmissionError(error, setError, "테넌트 정보를 저장하지 못했습니다.");
      toast.error(error, "테넌트 정보를 저장하지 못했습니다.");
    }
  };

  const onInvalid = (fieldErrors: FieldErrors<EditInput>) => {
    setError("root.validation", {
      type: "validation",
      message: buildValidationMessage(getValues(), fieldErrors, "edit"),
    });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const accepted = await confirm({
        title: `${organization.name}을(를) 삭제할까요?`,
        description: <><b className="font-bold text-red">삭제하면 되돌릴 수 없습니다.</b> 해당 업체의 건물·세대·수납 데이터와 관리자 계정이 모두 제거됩니다.</>,
        confirmLabel: "삭제",
        variant: "danger",
        look: "hq",
      });
      if (!accepted) return;
      const result = await deleteOrg.mutateAsync(organization.id);
      toast.success("테넌트를 삭제했어요");
      if (result.failedAccounts > 0) toast.warning(`로그인 계정 ${formatNumber(result.failedAccounts)}개는 지우지 못했어요`);
      onClose();
    } catch (error) {
      toast.error(error, "테넌트 삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!submitting) onClose();
      }}
      title={organization.name}
      className="flex max-h-[88vh] max-w-[min(520px,90%)] flex-col rounded-[20px] px-0 pb-5 pt-6 leading-[normal] shadow-hf-modal [&>h2]:px-6 [&>h2]:text-[17px] [&>h2]:leading-[normal] [&>h2]:tracking-[-0.02em] [&>h2]:text-t1"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      <p className="mt-[7px] px-6 text-[13px] font-semibold leading-[1.55] text-t3"><Description organization={organization} /></p>
      <form
        noValidate
        className="flex min-h-0 flex-1 flex-col"
        onChange={() => clearErrors("root")}
        onSubmit={handleSubmit(onValid, onInvalid)}
      >
        <div className="min-h-0 flex-1 overflow-auto px-6 pb-1">
          <OrganizationFormFields
            mode="edit"
            register={register as unknown as UseFormRegister<OrganizationFormValues>}
            control={control as unknown as Control<OrganizationFormValues>}
            errors={errors as unknown as FieldErrors<OrganizationFormValues>}
            editStatus={editStatus}
            onStatusChange={setEditStatus}
            contractFiles={contractFiles}
            onContractFilesChange={setContractFiles}
            maxNewFiles={Math.max(0, MAX_ATTACHMENT_FILES - keptPaths.length)}
            existing={existing}
            disabled={submitting}
            ownerUsername={ownerQuery.data?.username ?? undefined}
            ownerLoading={ownerQuery.isPending}
            ownerAvailable={Boolean(ownerQuery.data)}
          />
          {(errors.root?.validation?.message || errors.root?.server?.message) && (
            <div className="mt-3 rounded-[11px] border border-[rgba(233,79,79,0.22)] bg-[rgba(233,79,79,0.07)] px-[14px] py-[11px] text-[12.5px] font-bold leading-[1.5] text-red" role="alert">
              {errors.root.validation?.message ?? errors.root.server?.message}
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2 border-t border-line2 px-6 pt-4">
          <Button type="button" size="std" variant="danger" className="border border-red shadow-none" onClick={() => void handleDelete()} disabled={submitting}>삭제</Button>
          <div className="flex-1" />
          <Button type="button" size="std" variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" size="std" variant="primary" className="border border-transparent" disabled={submitting}>저장</Button>
        </div>
      </form>
    </Modal>
  );
}
