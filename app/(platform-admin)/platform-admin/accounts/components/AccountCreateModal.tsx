"use client";

import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Input, Modal, Select } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import {
  platformAccountCreateSchema,
  type PlatformAccountCreateValues,
} from "@/components/forms/schema/platformAccount";
import { usePlatformOrganizations } from "@/hooks/reactquery/platform";
import { ModalActions } from "../../../_components/ModalActions";
import { InlineAlert } from "../../../_components/InlineAlert";

type FormInput = z.input<typeof platformAccountCreateSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: PlatformAccountCreateValues) => Promise<void>;
  isPending: boolean;
}

const ROLE_OPTIONS = [
  { value: "org_owner", label: "조직 소유자" },
  { value: "manager", label: "관리자" },
  { value: "staff", label: "직원" },
];

const STAFF_TYPE_OPTIONS = [
  { value: "manager_staff", label: "직원(내근)" },
  { value: "field_staff", label: "현장 직원" },
  { value: "support_staff", label: "지원 직원" },
];

export function AccountCreateModal({ open, onClose, onSubmit, isPending }: Props) {
  const organizationsQuery = usePlatformOrganizations({ pageSize: 100 });
  const organizations = useMemo(
    () =>
      (organizationsQuery.data?.rows ?? []).filter(
        (organization) => !organization.deletedAt && organization.status !== "suspended",
      ),
    [organizationsQuery.data],
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, PlatformAccountCreateValues>({
    resolver: zodResolver(platformAccountCreateSchema),
    defaultValues: {
      orgId: organizations[0]?.id,
      username: "",
      password: "",
      fullName: "",
      phone: "",
      role: "staff",
      staffType: "manager_staff",
    },
  });

  React.useEffect(() => {
    if (!open) return;
    reset({
      orgId: organizations[0]?.id,
      username: "",
      password: "",
      fullName: "",
      phone: "",
      role: "staff",
      staffType: "manager_staff",
    });
  }, [open, organizations, reset]);

  const onValid = async (values: PlatformAccountCreateValues) => {
    await onSubmit(values);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="플랫폼 계정 발급">
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
        <FormField label="대상 조직" htmlFor="platform-account-org" error={errors.orgId?.message}>
          <select
            id="platform-account-org"
            aria-label="대상 조직"
            {...register("orgId")}
            className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 focus:border-brand focus:outline-none"
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </FormField>

        {organizations.length === 0 && (
          <InlineAlert tone="warning">
            계정을 발급할 수 있는 활성 조직이 없습니다.
          </InlineAlert>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="아이디" htmlFor="platform-account-username" error={errors.username?.message}>
            <Input
              id="platform-account-username"
              aria-label="아이디"
              {...register("username")}
              placeholder="예: admin"
            />
          </FormField>
          <FormField label="비밀번호(선택)" htmlFor="platform-account-password" error={errors.password?.message}>
            <Input
              id="platform-account-password"
              aria-label="비밀번호"
              type="password"
              {...register("password")}
              placeholder="비우면 자동 발급"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="이름" htmlFor="platform-account-name" error={errors.fullName?.message}>
            <Input
              id="platform-account-name"
              aria-label="이름"
              {...register("fullName")}
              placeholder="예: 김관리"
            />
          </FormField>
          <FormField label="연락처(선택)" htmlFor="platform-account-phone" error={errors.phone?.message}>
            <Input
              id="platform-account-phone"
              aria-label="연락처"
              {...register("phone")}
              placeholder="010-0000-0000"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="역할" htmlFor="platform-account-role" error={errors.role?.message}>
            <Select id="platform-account-role" {...register("role")} options={ROLE_OPTIONS} />
          </FormField>
          <FormField label="직원 유형" htmlFor="platform-account-staff-type" error={errors.staffType?.message}>
            <Select
              id="platform-account-staff-type"
              {...register("staffType")}
              options={STAFF_TYPE_OPTIONS}
            />
          </FormField>
        </div>

        <p className="text-xs text-t3">
          비밀번호를 비우면 서버가 임시 비밀번호를 발급하며, 발급 완료 후 한 번만 표시됩니다.
        </p>

        <ModalActions>
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isPending || organizations.length === 0}
          >
            {isPending ? "발급 중…" : "계정 발급"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
