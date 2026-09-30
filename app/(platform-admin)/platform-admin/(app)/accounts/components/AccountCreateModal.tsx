"use client";

import React, { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, CustomDropdown, Input, Modal, PhoneInput } from "@/components/common";
import { FormField } from "@/components/common/FormField";
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  platformAccountCreateSchema,
  type PlatformAccountCreateValues,
} from "@/components/forms/schema/platformAccount";
import { usePlatformOrganizations } from "@/hooks/reactquery/platform";
import { ModalActions } from "../../../../_components/ModalActions";
import { InlineAlert } from "../../../../_components/InlineAlert";
import {
  ADMIN_DROPDOWN_MENU_CLASS,
  ADMIN_FORM_DROPDOWN_CLASS,
} from "../../../../_components/adminDropdownClasses";

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

const INPUT_CLASS =
  "h-[42px] rounded-[10px] border border-line bg-surface px-[13px] text-[13.5px] font-semibold text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t";
const FORM_FIELD_CLASS =
  "[&>label]:mb-1.5 [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:text-t2";

export function AccountCreateModal({ open, onClose, onSubmit, isPending }: Props) {
  const organizationsQuery = usePlatformOrganizations({ pageSize: 100 });
  const organizations = useMemo(
    () =>
      (organizationsQuery.data?.rows ?? []).filter(
        (organization) => !organization.deletedAt && organization.status !== "suspended",
      ),
    [organizationsQuery.data],
  );
  const defaultOrgId = organizations[0]?.id;
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, PlatformAccountCreateValues>({
    resolver: zodResolver(platformAccountCreateSchema),
    defaultValues: {
      orgId: defaultOrgId,
      username: "",
      password: "",
      fullName: "",
      phone: "",
      role: "staff",
      staffType: "manager_staff",
    },
    shouldFocusError: true,
  });
  const submitting = isPending || isSubmitting;
  const defaults = React.useCallback((): FormInput => ({
    orgId: defaultOrgId,
    username: "",
    password: "",
    fullName: "",
    phone: "",
    role: "staff",
    staffType: "manager_staff",
  }), [defaultOrgId]);
  const closeSafely = () => {
    if (!submitting) onClose();
  };

  React.useEffect(() => {
    if (!open) return;
    reset(defaults());
  }, [defaults, open, reset]);

  const onValid = async (values: PlatformAccountCreateValues) => {
    try {
      await onSubmit(values);
      reset(defaults());
      onClose();
    } catch (error) {
      setSubmissionError(error, setError, "계정 발급에 실패했습니다.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={closeSafely}
      title="플랫폼 계정 발급"
      className="max-h-[88vh] max-w-[480px] overflow-y-auto rounded-[20px] [&>h2]:text-[17px] [&>h2]:font-extrabold [&>h2]:tracking-[-0.02em]"
    >
      <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-[18px]" noValidate>
        <FormField
          label="대상 조직"
          htmlFor="platform-account-org"
          error={errors.orgId?.message}
          className={FORM_FIELD_CLASS}
        >
          <div className={ADMIN_FORM_DROPDOWN_CLASS}>
            <Controller
              control={control}
              name="orgId"
              render={({ field }) => (
                <CustomDropdown
                  chevron="rotate"
                  chevronMs={180}
                  id="platform-account-org"
                  ariaLabel="대상 조직"
                  value={field.value == null ? "" : String(field.value)}
                  options={organizations.map((organization) => ({
                    value: String(organization.id),
                    label: organization.name,
                  }))}
                  position="fixed"
                  menuMinWidth={0}
                  menuClassName={ADMIN_DROPDOWN_MENU_CLASS}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </FormField>

        {organizations.length === 0 && (
          <InlineAlert tone="warning">
            계정을 발급할 수 있는 활성 조직이 없습니다.
          </InlineAlert>
        )}

        <div className="grid grid-cols-2 gap-[13px] gap-x-[15px]">
          <FormField label="아이디" htmlFor="platform-account-username" error={errors.username?.message} className={FORM_FIELD_CLASS}>
            <Input
              id="platform-account-username"
              aria-label="아이디"
              {...register("username")}
              placeholder="예: admin"
              className={INPUT_CLASS}
            />
          </FormField>
          <FormField label="비밀번호(선택)" htmlFor="platform-account-password" error={errors.password?.message} className={FORM_FIELD_CLASS}>
            <Input
              id="platform-account-password"
              aria-label="비밀번호"
              type="password"
              {...register("password")}
              placeholder="비우면 자동 발급"
              className={INPUT_CLASS}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-[13px] gap-x-[15px]">
          <FormField label="이름" htmlFor="platform-account-name" error={errors.fullName?.message} className={FORM_FIELD_CLASS}>
            <Input
              id="platform-account-name"
              aria-label="이름"
              {...register("fullName")}
              placeholder="예: 김관리"
              className={INPUT_CLASS}
            />
          </FormField>
          <FormField label="연락처(선택)" htmlFor="platform-account-phone" error={errors.phone?.message} className={FORM_FIELD_CLASS}>
            <PhoneInput
              id="platform-account-phone"
              aria-label="연락처"
              {...register("phone")}
              placeholder="010-0000-0000"
              className={INPUT_CLASS}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-[13px] gap-x-[15px]">
          <FormField label="역할" htmlFor="platform-account-role" error={errors.role?.message} className={FORM_FIELD_CLASS}>
            <div className={ADMIN_FORM_DROPDOWN_CLASS}>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <CustomDropdown
                    chevron="rotate"
                    chevronMs={180}
                    id="platform-account-role"
                    ariaLabel="역할"
                    value={String(field.value ?? "")}
                    options={ROLE_OPTIONS}
                    position="fixed"
                    menuMinWidth={0}
                    menuClassName={ADMIN_DROPDOWN_MENU_CLASS}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </FormField>
          <FormField label="직원 유형" htmlFor="platform-account-staff-type" error={errors.staffType?.message} className={FORM_FIELD_CLASS}>
            <div className={ADMIN_FORM_DROPDOWN_CLASS}>
              <Controller
                control={control}
                name="staffType"
                render={({ field }) => (
                  <CustomDropdown
                    chevron="rotate"
                    chevronMs={180}
                    id="platform-account-staff-type"
                    ariaLabel="직원 유형"
                    value={String(field.value ?? "")}
                    options={STAFF_TYPE_OPTIONS}
                    position="fixed"
                    menuMinWidth={0}
                    menuClassName={ADMIN_DROPDOWN_MENU_CLASS}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </FormField>
        </div>

        <p className="text-xs text-t3">
          비밀번호를 비우면 서버가 임시 비밀번호를 발급하며, 발급 완료 후 한 번만 표시됩니다.
        </p>

        {errors.root?.server?.message && (
          <InlineAlert tone="dangerStrong" role="alert">
            {errors.root.server.message}
          </InlineAlert>
        )}

        <ModalActions>
          <Button
            variant="ghost"
            type="button"
            onClick={closeSafely}
            disabled={submitting}
          >
            취소
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={submitting || organizations.length === 0}
            className="submit disabled:cursor-not-allowed"
          >
            {submitting ? "발급 중…" : "계정 발급"}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
