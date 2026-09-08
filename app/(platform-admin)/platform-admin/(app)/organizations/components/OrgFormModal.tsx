"use client";

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
import { Modal, Input, Button } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import {
  orgCreateSchema,
  orgEditSchema,
  type OrgCreateFormValues,
  type OrgEditFormValues,
} from "@/components/forms/schema/platformOrganization";
import { getOrganizationContractFilePreview } from "@/hooks/reactquery/platform";
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

type EditProps = {
  mode: "edit";
  open: boolean;
  onClose: () => void;
  defaultValues: OrgEditFormValues;
  defaultContractFilePath: string | null;
  onSubmit: (values: OrgEditSubmitValues) => Promise<void>;
  isPending: boolean;
};

export function OrgFormModal(props: CreateProps | EditProps) {
  if (props.mode === "create") return <CreateModal {...props} />;
  return <EditModal {...props} />;
}

type EditInput = z.input<typeof orgEditSchema>;
type CommonFieldName = keyof EditInput;

const ORGANIZATION_FIELDS: Array<{
  name: CommonFieldName;
  label: string;
  type?: React.HTMLInputTypeAttribute;
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
  },
  { name: "phone", label: "대표 전화 *", type: "tel", placeholder: "02-1234-5678" },
  { name: "fax", label: "팩스 번호 *", type: "tel", placeholder: "02-1234-5679" },
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
        return (
          <FormField
            key={field.name}
            label={field.label}
            htmlFor={id}
            error={error?.message}
            className={`${field.full ? "sm:col-span-2" : ""} ${FORM_FIELD_CLASS}`}
          >
            <Input
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
  id,
  selectedFile,
  currentPath,
  removeExisting,
  onSelect,
  onRemove,
}: {
  id: string;
  selectedFile: File | null;
  currentPath: string | null;
  removeExisting: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
}) {
  const [localPreview, setLocalPreview] = React.useState<{
    file: File;
    url: string;
  } | null>(null);
  const [remotePreview, setRemotePreview] = React.useState<{
    path: string;
    url: string | null;
    error: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (!selectedFile) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        setLocalPreview({ file: selectedFile, url: reader.result });
      }
    });
    reader.readAsDataURL(selectedFile);
    return () => reader.abort();
  }, [selectedFile]);

  React.useEffect(() => {
    if (!currentPath || selectedFile || removeExisting) return;
    let disposed = false;
    void getOrganizationContractFilePreview(currentPath)
      .then((url) => {
        if (!disposed) setRemotePreview({ path: currentPath, url, error: false });
      })
      .catch(() => {
        if (!disposed) setRemotePreview({ path: currentPath, url: null, error: true });
      });
    return () => {
      disposed = true;
    };
  }, [currentPath, removeExisting, selectedFile]);

  const previewUrl = selectedFile
    ? (localPreview?.file === selectedFile ? localPreview.url : null)
    : (!removeExisting && remotePreview?.path === currentPath ? remotePreview.url : null);
  const previewError = !selectedFile
    && !removeExisting
    && remotePreview?.path === currentPath
    && remotePreview.error;

  const fileName = selectedFile?.name ?? currentPath?.split("/").at(-1);

  return (
    <div>
      <div className="mb-1.5 text-[12.5px] font-bold text-t2">계약서 사진</div>
      <label
        htmlFor={id}
        className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-line bg-surface p-5 text-center transition-colors hover:border-blue hover:bg-blue-t2"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-[22px] w-[22px] text-blue"
          aria-hidden="true"
        >
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
        </svg>
        <span className="text-[13px] font-bold text-t1">사진 선택</span>
        <span className="text-xs font-medium text-t3">JPG · PNG · WEBP, 최대 10MB</span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onSelect(file);
          event.target.value = "";
        }}
      />

      {(previewUrl || previewError) && (
        <div className="mt-3 rounded-xl border border-line bg-bg/40 p-3">
          {previewUrl ? (
            // Signed Storage URLs and local blob URLs are intentionally rendered without optimization.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="계약서 미리보기"
              className="max-h-52 w-full rounded-lg object-contain"
            />
          ) : (
            <p className="py-6 text-center text-xs text-danger">미리보기를 불러오지 못했습니다.</p>
          )}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="truncate text-xs text-t3">{fileName}</span>
            <button type="button" onClick={onRemove} className="text-xs font-bold text-red">
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

function CreateModal({ open, onClose, onSubmit, isPending }: Omit<CreateProps, "mode">) {
  const [contractFile, setContractFile] = React.useState<File | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateInput, unknown, OrgCreateFormValues>({
    resolver: zodResolver(orgCreateSchema),
    defaultValues: CREATE_DEFAULTS,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="관리회사 입점"
      className="max-h-[88vh] max-w-[520px] overflow-y-auto [&>h2]:text-[17px] [&>h2]:tracking-[-0.02em]"
    >
      <form
        onSubmit={handleSubmit((values) => onSubmit({ ...values, contractFile }))}
        className="flex flex-col gap-[18px]"
      >
        <OrganizationFields idPrefix="create-org" register={register} errors={errors} />
        <ContractFileField
          id="create-org-contract-file"
          selectedFile={contractFile}
          currentPath={null}
          removeExisting={false}
          onSelect={setContractFile}
          onRemove={() => setContractFile(null)}
        />

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
            <Input
              id="owner-phone"
              type="tel"
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
            onClick={onClose}
            className="h-10 cursor-pointer whitespace-nowrap rounded-[11px] px-[15px] text-[13.5px]"
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isPending || isSubmitting}
            className="h-10 cursor-pointer whitespace-nowrap rounded-[11px] px-[15px] text-[13.5px]"
          >
            {isPending || isSubmitting ? "등록 중…" : "입점 등록"}
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
    formState: { errors, isSubmitting },
  } = useForm<EditInput, unknown, OrgEditFormValues>({
    resolver: zodResolver(orgEditSchema),
    defaultValues,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="조직 계약 정보 수정"
      className="max-h-[88vh] max-w-[520px] overflow-y-auto [&>h2]:text-[17px] [&>h2]:tracking-[-0.02em]"
    >
      <form
        onSubmit={handleSubmit((values) => onSubmit({
          ...values,
          contractFile,
          removeContractFile,
        }))}
        className="flex flex-col gap-[18px]"
      >
        <OrganizationFields idPrefix="edit-org" register={register} errors={errors} />
        <ContractFileField
          id="edit-org-contract-file"
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
        />

        <ModalActions>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-10 cursor-pointer whitespace-nowrap rounded-[11px] px-[15px] text-[13.5px]"
          >
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isPending || isSubmitting}
            className="h-10 cursor-pointer whitespace-nowrap rounded-[11px] px-[15px] text-[13.5px]"
          >
            {isPending || isSubmitting ? "저장 중…" : "저장"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
