"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal, Input, Button } from "@/components/common";
import {
  orgCreateSchema,
  orgEditSchema,
  type OrgCreateFormValues,
  type OrgEditFormValues,
} from "@/components/forms/schema/platformOrganization";

type CreateProps = {
  mode: "create";
  open: boolean;
  onClose: () => void;
  onSubmit: (values: OrgCreateFormValues) => Promise<void>;
  isPending: boolean;
};
type EditProps = {
  mode: "edit";
  open: boolean;
  onClose: () => void;
  defaultValues: OrgEditFormValues;
  onSubmit: (values: OrgEditFormValues) => Promise<void>;
  isPending: boolean;
};

export function OrgFormModal(props: CreateProps | EditProps) {
  if (props.mode === "create") return <CreateModal {...props} />;
  return <EditModal {...props} />;
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-t3">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

type CreateInput = z.input<typeof orgCreateSchema>;
const CREATE_DEFAULTS: CreateInput = {
  name: "",
  slug: "",
  phone: "",
  ownerUsername: "",
  ownerFullName: "",
  ownerPhone: "",
};

function CreateModal({ open, onClose, onSubmit, isPending }: Omit<CreateProps, "mode">) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateInput, unknown, OrgCreateFormValues>({
    resolver: zodResolver(orgCreateSchema),
    defaultValues: CREATE_DEFAULTS,
  });

  React.useEffect(() => {
    if (open) reset(CREATE_DEFAULTS);
  }, [open, reset]);

  const onValid = async (values: OrgCreateFormValues) => {
    await onSubmit(values);
  };

  return (
    <Modal open={open} onClose={onClose} title="관리회사 입점">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <Field label="회사명" htmlFor="org-name" error={errors.name?.message}>
          <Input id="org-name" aria-label="회사명" {...register("name")} placeholder="예: 한빛관리" />
        </Field>
        <Field label="회사코드(영문 소문자·숫자·하이픈)" htmlFor="org-slug" error={errors.slug?.message}>
          <Input id="org-slug" aria-label="회사코드" {...register("slug")} placeholder="예: hanbit" />
        </Field>
        <Field label="대표 연락처(선택)" htmlFor="org-phone" error={errors.phone?.message}>
          <Input id="org-phone" aria-label="대표 연락처" {...register("phone")} placeholder="예: 02-1234-5678" />
        </Field>

        <hr className="border-line" />
        <p className="text-xs font-bold text-t2">첫 관리자(owner) 계정</p>

        <Field label="관리자 아이디" htmlFor="owner-username" error={errors.ownerUsername?.message}>
          <Input id="owner-username" aria-label="관리자 아이디" {...register("ownerUsername")} placeholder="예: admin" />
        </Field>
        <Field label="관리자 이름" htmlFor="owner-name" error={errors.ownerFullName?.message}>
          <Input id="owner-name" aria-label="관리자 이름" {...register("ownerFullName")} placeholder="예: 홍길동" />
        </Field>
        <Field label="관리자 연락처(선택)" htmlFor="owner-phone" error={errors.ownerPhone?.message}>
          <Input id="owner-phone" aria-label="관리자 연락처" {...register("ownerPhone")} placeholder="예: 010-1234-5678" />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "등록 중…" : "입점 등록"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type EditInput = z.input<typeof orgEditSchema>;

function EditModal({ open, onClose, defaultValues, onSubmit, isPending }: Omit<EditProps, "mode">) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditInput, unknown, OrgEditFormValues>({
    resolver: zodResolver(orgEditSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) reset(defaultValues);
  }, [open, defaultValues, reset]);

  const onValid = async (values: OrgEditFormValues) => {
    await onSubmit(values);
  };

  return (
    <Modal open={open} onClose={onClose} title="조직 정보 수정">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <Field label="회사명" htmlFor="edit-org-name" error={errors.name?.message}>
          <Input id="edit-org-name" aria-label="회사명" {...register("name")} />
        </Field>
        <Field label="회사코드(영문 소문자·숫자·하이픈)" htmlFor="edit-org-slug" error={errors.slug?.message}>
          <Input id="edit-org-slug" aria-label="회사코드" {...register("slug")} />
        </Field>
        <Field label="대표 연락처(선택)" htmlFor="edit-org-phone" error={errors.phone?.message}>
          <Input id="edit-org-phone" aria-label="대표 연락처" {...register("phone")} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
