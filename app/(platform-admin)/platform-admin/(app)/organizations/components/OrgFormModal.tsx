"use client";

import Image from "next/image";
import React from "react";
import {
  useForm,
  type FieldError,
  type FieldErrors,
  type FieldValues,
  type Path,
  type UseFormRegister,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Input, Button, BizRegNoInput, PhoneInput, PhotoUpload } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  orgCreateSchema,
  orgEditSchema,
  type OrgCreateFormValues,
  type OrgEditFormValues,
} from "@/components/forms/schema/platformOrganization";
import { useOrganizationContractFilePreview } from "@/hooks/reactquery/platform";
import { ModalActions } from "../../../../_components/ModalActions";

export type OrgCreateSubmitValues = OrgCreateFormValues & {
  contractFile: File | null;
};

export type OrgEditSubmitValues = OrgEditFormValues & {
  contractFile: File | null;
  removeContractFile: boolean;
};

type CreateProps = {
  mode: "create";
  open: boolean;
  onClose: () => void;
  onSubmit: (values: OrgCreateSubmitValues) => Promise<void>;
  isPending: boolean;
};

type EditInput = z.input<typeof orgEditSchema>;
type EditProps = {
  mode: "edit";
  open: boolean;
  onClose: () => void;
  defaultValues: EditInput;
  defaultContractFilePath: string | null;
  onSubmit: (values: OrgEditSubmitValues) => Promise<void>;
  isPending: boolean;
};

export function OrgFormModal(props: CreateProps | EditProps) {
  if (props.mode === "create") return <CreateModal {...props} />;
  return <EditModal {...props} />;
}

type CommonFieldName = keyof EditInput;

const ORGANIZATION_FIELDS: Array<{
  name: CommonFieldName;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  /** 마스크가 걸린 입력을 쓰는 필드는 그 컴포넌트를 직접 준다(형식이 늘어도 분기를 안 늘린다). */
  input?: typeof Input;
  placeholder?: string;
  full?: boolean;
}> = [
  { name: "contractStartDate", label: "계약 시작일 *", type: "date" },
  { name: "contractEndDate", label: "계약 만료일 *", type: "date" },
  { name: "name", label: "상호 *", placeholder: "예: 한빛관리", full: true },
  { name: "slug", label: "회사코드 *", placeholder: "영문 소문자·숫자·하이픈" },
  { name: "region", label: "지역 *", placeholder: "예: 대전 유성구" },
  { name: "representativeName", label: "대표자 *", placeholder: "예: 홍길동" },
  {
    name: "businessRegistrationNumber",
    label: "사업자등록번호 *",
    placeholder: "000-00-00000",
    input: BizRegNoInput,
  },
  { name: "phone", label: "대표 전화 *", placeholder: "02-1234-5678", input: PhoneInput },
  { name: "fax", label: "팩스 번호 *", placeholder: "02-1234-5679", input: PhoneInput },
  {
    name: "email",
    label: "이메일 *",
    type: "email",
    placeholder: "admin@company.co.kr",
    full: true,
  },
  {
    name: "address",
    label: "주소 *",
    placeholder: "도로명 주소와 상세 주소",
    full: true,
  },
  {
    name: "operatingHours",
    label: "운영 시간",
    placeholder: "평일 09:00 ~ 18:00",
    full: true,
  },
];

const ORGANIZATION_INPUT_CLASS =
  "h-[42px] rounded-[10px] px-[13px] text-[13.5px] font-semibold placeholder:font-medium focus:ring-[3px] focus:ring-blue-t";
const FORM_FIELD_CLASS =
  "[&>label]:mb-1.5 [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:text-t2";

function OrganizationFields<T extends FieldValues & EditInput>({
  idPrefix,
  register,
  errors,
}: {
  idPrefix: string;
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
}) {
  return (
    <div className="grid gap-[13px] sm:grid-cols-2 sm:gap-x-[15px]">
      {ORGANIZATION_FIELDS.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const error = errors[field.name] as FieldError | undefined;
        const FieldInput = field.input ?? Input;
        return (
          <FormField
            key={field.name}
            label={field.label}
            htmlFor={id}
            error={error?.message}
            className={`${field.full ? "sm:col-span-2" : ""} ${FORM_FIELD_CLASS}`}
          >
            <FieldInput
              id={id}
              type={field.type}
              placeholder={field.placeholder}
              className={ORGANIZATION_INPUT_CLASS}
              {...register(field.name as Path<T>)}
            />
          </FormField>
        );
      })}
    </div>
  );
}

function ContractFileField({
  selectedFile,
  currentPath,
  removeExisting,
  onSelect,
  onRemove,
  disabled,
}: {
  selectedFile: File | null;
  currentPath: string | null;
  removeExisting: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const confirm = useConfirm();
  const selectedFiles = React.useMemo(() => selectedFile ? [selectedFile] : [], [selectedFile]);
  const remotePath = !selectedFile && !removeExisting ? currentPath : null;
  const remotePreview = useOrganizationContractFilePreview(remotePath);
  const fileName = currentPath?.split("/").at(-1);

  return (
    <div>
      <PhotoUpload
        label="계약서 사진"
        files={selectedFiles}
        onFilesChange={(files) => {
          if (files[0]) onSelect(files[0]);
          else onRemove();
        }}
        max={1}
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
      />

      {(remotePreview.data || remotePreview.isError) && (
        <div className="mt-3 rounded-xl border border-line bg-bg/40 p-3">
          {remotePreview.data ? (
            <div className="relative h-52 w-full">
              <Image
                src={remotePreview.data}
                alt="계약서 미리보기"
                fill
                sizes="100vw"
                className="rounded-lg object-contain"
              />
            </div>
          ) : (
            <p className="py-6 text-center text-xs text-danger">미리보기를 불러오지 못했습니다.</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="truncate text-xs text-t3">{fileName}</span>
            <button
              type="button"
              onClick={async () => {
                const accepted = await confirm({
                  title: "계약서 사진 삭제",
                  description: `${fileName ?? "저장된 계약서"} 파일을 삭제할까요?`,
                  confirmLabel: "삭제",
                  variant: "danger",
                });
                if (accepted) onRemove();
              }}
              disabled={disabled}
              className="text-xs font-bold text-red disabled:opacity-40"
            >
              제거
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

type CreateInput = z.input<typeof orgCreateSchema>;
const CREATE_DEFAULTS: CreateInput = {
  name: "",
  slug: "",
  phone: "",
  contractStartDate: "",
  contractEndDate: "",
  representativeName: "",
  businessRegistrationNumber: "",
  fax: "",
  email: "",
  address: "",
  region: "",
  operatingHours: "",
  ownerUsername: "",
  ownerFullName: "",
  ownerPhone: "",
};
const CREATE_FIELD_ORDER: Array<keyof CreateInput> = [
  ...ORGANIZATION_FIELDS.map((field) => field.name),
  "ownerUsername",
  "ownerFullName",
  "ownerPhone",
];

function CreateModal({ open, onClose, onSubmit, isPending }: Omit<CreateProps, "mode">) {
  const [contractFile, setContractFile] = React.useState<File | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<CreateInput, unknown, OrgCreateFormValues>({
    resolver: zodResolver(orgCreateSchema),
    defaultValues: CREATE_DEFAULTS,
    shouldFocusError: false,
  });
  const submitting = isPending || isSubmitting;
  const closeSafely = () => {
    if (submitting) return;
    reset(CREATE_DEFAULTS);
    setContractFile(null);
    onClose();
  };

  React.useEffect(() => {
    if (!open) return;
    reset(CREATE_DEFAULTS);
  }, [open, reset]);

  return (
    <Modal
      open={open}
      onClose={closeSafely}
      title="관리회사 입점"
      className="max-h-[88vh] max-w-[520px] overflow-y-auto [&>h2]:text-[17px] [&>h2]:tracking-[-0.02em]"
    >
      <form
        onSubmit={handleSubmit(
          async (values) => {
            try {
              await onSubmit({ ...values, contractFile });
              reset(CREATE_DEFAULTS);
              setContractFile(null);
              onClose();
            } catch (error) {
              setSubmissionError(error, setError, "관리회사 입점에 실패했습니다.");
            }
          },
          (fieldErrors) => {
            const first = CREATE_FIELD_ORDER.find((field) => fieldErrors[field]);
            if (first) setFocus(first);
          },
        )}
        className="flex flex-col gap-[18px]"
        noValidate
      >
        <OrganizationFields idPrefix="create-org" register={register} errors={errors} />
        <ContractFileField
          selectedFile={contractFile}
          currentPath={null}
          removeExisting={false}
          onSelect={setContractFile}
          onRemove={() => setContractFile(null)}
          disabled={submitting}
        />

        {errors.root?.server?.message && (
          <p role="alert" className="rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red">
            {errors.root.server.message}
          </p>
        )}

        <hr className="border-line2" />
        <p className="text-[12.5px] font-bold text-t2">첫 관리자(owner) 계정</p>
        <div className="grid gap-[13px] sm:grid-cols-2 sm:gap-x-[15px]">
          <FormField
            label="관리자 아이디 *"
            htmlFor="owner-username"
            error={errors.ownerUsername?.message}
            className={FORM_FIELD_CLASS}
          >
            <Input
              id="owner-username"
              {...register("ownerUsername")}
              placeholder="예: admin"
              className={ORGANIZATION_INPUT_CLASS}
            />
          </FormField>
          <FormField
            label="관리자 이름 *"
            htmlFor="owner-name"
            error={errors.ownerFullName?.message}
            className={FORM_FIELD_CLASS}
          >
            <Input
              id="owner-name"
              {...register("ownerFullName")}
              placeholder="예: 홍길동"
              className={ORGANIZATION_INPUT_CLASS}
            />
          </FormField>
          <FormField
            label="관리자 연락처"
            htmlFor="owner-phone"
            error={errors.ownerPhone?.message}
            className={`sm:col-span-2 ${FORM_FIELD_CLASS}`}
          >
            <PhoneInput
              id="owner-phone"
              {...register("ownerPhone")}
              placeholder="010-1234-5678"
              className={ORGANIZATION_INPUT_CLASS}
            />
          </FormField>
        </div>

        <ModalActions>
          <Button
            type="button"
            variant="ghost"
            onClick={closeSafely}
            disabled={submitting}
            className="h-10 cursor-pointer whitespace-nowrap rounded-[11px] px-[15px] text-[13.5px]"
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="h-10 cursor-pointer whitespace-nowrap rounded-[11px] px-[15px] text-[13.5px]"
          >
            {submitting ? "등록 중…" : "입점 등록"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

function EditModal({
  open,
  onClose,
  defaultValues,
  defaultContractFilePath,
  onSubmit,
  isPending,
}: Omit<EditProps, "mode">) {
  const [contractFile, setContractFile] = React.useState<File | null>(null);
  const [removeContractFile, setRemoveContractFile] = React.useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditInput, unknown, OrgEditFormValues>({
    resolver: zodResolver(orgEditSchema),
    defaultValues,
    shouldFocusError: true,
  });
  const submitting = isPending || isSubmitting;
  const closeSafely = () => {
    if (submitting) return;
    reset(defaultValues);
    setContractFile(null);
    setRemoveContractFile(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={closeSafely}
      title="조직 계약 정보 수정"
      className="max-h-[88vh] max-w-[520px] overflow-y-auto [&>h2]:text-[17px] [&>h2]:tracking-[-0.02em]"
    >
      <form
        onSubmit={handleSubmit(async (values) => {
          try {
            await onSubmit({
              ...values,
              contractFile,
              removeContractFile,
            });
            reset(defaultValues);
            setContractFile(null);
            setRemoveContractFile(false);
            onClose();
          } catch (error) {
            setSubmissionError(error, setError, "조직 계약 정보를 저장하지 못했습니다.");
          }
        })}
        className="flex flex-col gap-[18px]"
        noValidate
      >
        <OrganizationFields idPrefix="edit-org" register={register} errors={errors} />
        <ContractFileField
          selectedFile={contractFile}
          currentPath={defaultContractFilePath}
          removeExisting={removeContractFile}
          onSelect={(file) => {
            setContractFile(file);
            setRemoveContractFile(false);
          }}
          onRemove={() => {
            if (contractFile) setContractFile(null);
            else setRemoveContractFile(true);
          }}
          disabled={submitting}
        />

        {errors.root?.server?.message && (
          <p role="alert" className="rounded-xl bg-red-t px-3 py-2 text-sm font-semibold text-red">
            {errors.root.server.message}
          </p>
        )}

        <ModalActions>
          <Button
            type="button"
            variant="ghost"
            onClick={closeSafely}
            disabled={submitting}
            className="h-10 cursor-pointer whitespace-nowrap rounded-[11px] px-[15px] text-[13.5px]"
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="h-10 cursor-pointer whitespace-nowrap rounded-[11px] px-[15px] text-[13.5px]"
          >
            {submitting ? "저장 중…" : "저장"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
