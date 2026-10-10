"use client";
import { PASSWORD_MAX_LENGTH, PASSWORD_RULE_TEXT } from "@/lib/auth/passwordPolicy";

import React from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, CustomDropdown, Input, Modal, PhoneInput } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { FormField } from '@/components/common/FormField';
import { setSubmissionError } from "@/components/forms/formErrors";
import {
  accountCreateSchema,
  accountEditSchema,
  type AccountCreateInput as AccountCreateFormInput,
  type AccountCreateValues,
  type AccountEditInput as AccountEditFormInput,
  type AccountEditValues,
} from "@/components/forms/schema/account";
import type {
  Account,
  AccountBasicInput,
  AccountCreateInput,
  PermissionInput,
} from "@/hooks/reactquery/accounts";
import type { StaffType } from "@/hooks/reactquery/auth";
import { PermissionChecklist } from "./PermissionChecklist";

// 마이그 0219 적용 전 배포 구간에는 목록이 아직 별표 번호(010-****-1234)를 줄 수 있다.
// 그대로 저장하면 원문이 별표로 덮이고, 빈 값으로 보내면 RPC(nullif)가 번호를 지운다 → 별표가 보이면 저장을 막는다.
const isMaskedPhone = (value: string | null | undefined) => Boolean(value && value.includes("*"));

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Account | null;
  createStaffType: StaffType;
  canEditPermissions: boolean;
  onCreate: (input: AccountCreateInput) => Promise<{ userId: string }>;
  onUpdateBasic: (userId: string, input: AccountBasicInput) => Promise<void>;
  onUpdatePermissions: (userId: string, input: PermissionInput) => Promise<void>;
  onResetPassword: (userId: string, password: string) => Promise<void>;
  onSetActive: (userId: string, active: boolean, successMessage?: string) => Promise<void>;
  isPending: boolean;
}

type FormInput = AccountCreateFormInput | AccountEditFormInput;
type FormValues = AccountCreateValues | AccountEditValues;

const MEMBER_TYPE_OPTIONS = [
  { value: "master", label: "마스터" },
  { value: "normal", label: "일반" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "활성화" },
  { value: "inactive", label: "비활성화" },
];

function RequiredMark() {
  return <span className="text-danger">*</span>;
}

export function AccountFormModal({
  open,
  onClose,
  editing,
  createStaffType,
  canEditPermissions,
  onCreate,
  onUpdateBasic,
  onUpdatePermissions,
  onResetPassword,
  onSetActive,
  isPending,
}: Props) {
  const confirm = useConfirm();
  const isEdit = !!editing;
  const isTenant = editing?.staffType === "tenant";
  const modalStaffType = editing?.staffType ?? createStaffType;
  const isField = modalStaffType === "field_staff" || modalStaffType === "support_staff";
  const makeDefaults = React.useCallback(
    (): FormInput =>
      editing
        ? {
            username: editing.username,
            // 비밀번호 원문은 보관하지 않는다 — 비워 두면 그대로, 입력하면 임시 비밀번호로 재설정.
            password: "",
            fullName: editing.fullName,
            phone: editing.phone ?? "",
            staffType: editing.staffType,
            isMaster: editing.role === "org_owner" || editing.role === "platform_admin",
            isActive: editing.isActive,
            permissions: editing.permissions,
            roleIds: [],
            alsoCrossApp: (() => {
              const caps = editing.staffCapabilities ?? [];
              const primaryIsField =
                editing.staffType === "field_staff" || editing.staffType === "support_staff";
              return primaryIsField
                ? caps.includes("manager_staff")
                : caps.some((c) => c === "field_staff" || c === "support_staff");
            })(),
          }
        : {
            username: "",
            password: "",
            fullName: "",
            phone: "",
            staffType: createStaffType,
            isMaster: false,
            isActive: true,
            permissions: [],
            roleIds: [],
            alsoCrossApp: false,
          },
    [createStaffType, editing],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(isEdit ? accountEditSchema : accountCreateSchema) as unknown as Resolver<FormInput, unknown, FormValues>,
    defaultValues: makeDefaults(),
    shouldFocusError: true,
  });
  const submitting = isPending || isSubmitting;
  const closeSafely = () => {
    if (!submitting) onClose();
  };

  React.useEffect(() => {
    if (open) reset(makeDefaults());
  }, [makeDefaults, open, reset]);

  const selectedMaster = useWatch({ control, name: "isMaster" });
  const passwordField = register("password");

  const onValid = async (values: FormValues) => {
    if (isEdit && editing && (isMaskedPhone(values.phone) || isMaskedPhone(editing.phoneSub))) {
      setError("root.server", {
        type: "server",
        message: "전화번호가 가려진 상태라 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    try {
      const role = values.isMaster
        ? "org_owner"
        : values.staffType === "field_staff"
          ? "field"
          : "staff";

      const crossType: StaffType = isField ? "manager_staff" : "field_staff";
      const staffCapabilities = isEdit && editing
        ? editing.staffCapabilities
        : values.alsoCrossApp
          ? [values.staffType, crossType]
          : [values.staffType];

      if (!isEdit) {
        const created = await onCreate({
          username: values.username ?? "",
          password: values.password ?? "",
          fullName: values.fullName,
          phone: values.phone || undefined,
          role,
          staffType: values.staffType,
          permissions: values.permissions,
          roleIds: [],
          staffCapabilities,
        });
        if (!values.isActive) await onSetActive(created.userId, false);
      } else if (editing) {
        await onUpdateBasic(editing.userId, {
          fullName: values.fullName,
          phone: values.phone || undefined,
          phoneSub: editing.phoneSub ?? undefined,
          staffType: values.staffType,
          affiliation: editing.affiliation || undefined,
          roleIds: null,
          staffCapabilities,
        });
        if (canEditPermissions) {
          await onUpdatePermissions(editing.userId, {
            role,
            staffType: values.staffType,
            permissions: values.permissions,
            roleIds: null,
          });
        }
        if (values.password) {
          await onResetPassword(editing.userId, values.password);
        }
        if (values.isActive !== editing.isActive) {
          await onSetActive(editing.userId, values.isActive);
        }
      }
      reset(makeDefaults());
      onClose();
    } catch (error) {
      setSubmissionError(error, setError, "계정 정보를 저장하지 못했습니다.");
    }
  };

  const deactivate = async () => {
    if (!editing) return;
    const ok = await confirm({
      title: "계정을 삭제할까요?",
      description: `${editing.fullName} 계정이 삭제되며 되돌릴 수 없어요.`,
      confirmLabel: "삭제",
      variant: "danger",
      look: "left",
    });
    if (!ok) return;
    try {
      await onSetActive(editing.userId, false, "계정을 삭제했어요");
      onClose();
    } catch {
      // The page handler keeps the modal open and shows the error toast.
    }
  };

  const title = isEdit
    ? "계정 정보"
    : `${isField ? "현장 관리자" : "사무실 관리자"} 등록`;

  return (
    <Modal
      open={open}
      onClose={closeSafely}
      title={title}
      overlayClassName="items-start overflow-auto py-[20px]"
      /* 정본 제목은 18px / line-height:normal. 공용 Modal의 text-lg가 28px 줄높이를
         물고 오므로 자식 셀렉터로 되돌린다(Modal 자체는 다른 화면들이 쓰므로 무변경). */
      className="my-auto flex max-h-[calc(100%-40px)] max-w-[560px] flex-col rounded-[20px] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.4)] [&>h2]:text-[18px] [&>h2]:leading-[normal]"
      bodyClassName="mt-[4px] flex min-h-0 flex-1 flex-col"
    >
      {isTenant ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-[normal] text-t2">
            세입자 계정은 <b>입주자 상세에서</b> 생성·관리합니다. 이 화면에서는 조회·비활성·비밀번호 재설정만 가능합니다.
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onValid)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <p className="mb-[16px] flex-none text-[13px] font-semibold leading-[normal] text-t3">필수 항목(*)을 입력해 주세요</p>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-x-[15px] gap-y-[13px]">
              <FormField
                htmlFor="username"
                label={<>아이디 <RequiredMark /></>}
                error={errors.username && <>{errors.username.message}</>}
                className="[&>label]:mb-[6px] [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:leading-[normal] [&>label]:text-t2 [&>p]:leading-[normal]"
              >
                <Input
                  id="username"
                  aria-label="아이디"
                  {...register("username")}
                  placeholder="아이디 입력"
                  readOnly={isEdit}
                  className={`h-[40px] w-full rounded-[11px]! border border-line bg-surface px-[12px] text-[14px] font-medium leading-[normal] text-t1 outline-none placeholder:text-[#757575]! focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-tint)] ${errors.username ? "border-danger" : ""}`}
                />
              </FormField>

              <FormField
                htmlFor="password"
                label={<>비밀번호 {!isEdit && <RequiredMark />}</>}
                error={errors.password && <>{errors.password.message}</>}
                className="[&>label]:mb-[6px] [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:leading-[normal] [&>label]:text-t2 [&>p]:leading-[normal]"
              >
                <Input
                  id="password"
                  aria-label="비밀번호"
                  type="text"
                  maxLength={PASSWORD_MAX_LENGTH}
                  autoComplete="new-password"
                  required={!isEdit}
                  {...passwordField}
                  placeholder={isEdit ? `변경할 때만 입력 (${PASSWORD_RULE_TEXT})` : `임시 비밀번호 (${PASSWORD_RULE_TEXT})`}
                  className={`h-[40px] w-full rounded-[11px]! border border-line bg-surface px-[12px] text-[14px] font-medium leading-[normal] text-t1 outline-none placeholder:text-[#757575]! focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-tint)] ${errors.password ? "border-danger" : ""}`}
                />
              </FormField>

              <FormField
                htmlFor="fullName"
                label={<>이름 <RequiredMark /></>}
                error={errors.fullName && <>{errors.fullName.message}</>}
                className="[&>label]:mb-[6px] [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:leading-[normal] [&>label]:text-t2 [&>p]:leading-[normal]"
              >
                <Input
                  id="fullName"
                  aria-label="이름"
                  {...register("fullName")}
                  placeholder="이름 입력"
                  className={`h-[40px] w-full rounded-[11px]! border border-line bg-surface px-[12px] text-[14px] font-medium leading-[normal] text-t1 outline-none placeholder:text-[#757575]! focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-tint)] ${errors.fullName ? "border-danger" : ""}`}
                />
              </FormField>

              <FormField
                htmlFor="phone"
                label="연락처"
                className="[&>label]:mb-[6px] [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:leading-[normal] [&>label]:text-t2 [&>p]:leading-[normal]"
              >
                <PhoneInput
                  id="phone"
                  aria-label="연락처"
                  {...register("phone")}
                  placeholder="010-0000-0000"
                  className="h-[40px] w-full rounded-[11px]! border border-line bg-surface px-[12px] text-[14px] font-medium leading-[normal] text-t1 outline-none placeholder:text-[#757575]! focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-tint)] num tabular-nums"
                />
              </FormField>

              {!isField && (
                <FormField
                  htmlFor="memberType"
                  label="회원 유형"
                  className="[&>label]:mb-[6px] [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:leading-[normal] [&>label]:text-t2 [&>p]:leading-[normal] [&_.uc-dd-btn]:h-[40px] [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:rounded-[11px] [&_.uc-dd-btn]:px-[10px] [&_.uc-dd-btn]:text-[14px] [&_.uc-dd-btn]:font-semibold [&_.uc-dd-btn]:leading-[normal] [&_.uc-dd-lbl]:text-[13.5px]"
                >
                  <Controller
                    control={control}
                    name="isMaster"
                    render={({ field }) => (
                      <CustomDropdown
                        chevron="rotate"
                        ariaLabel="회원 유형"
                        options={MEMBER_TYPE_OPTIONS}
                        value={field.value ? "master" : "normal"}
                        disabled={!canEditPermissions}
                        variant="field"
                        position="fixed"
                        onChange={(value) => field.onChange(value === "master")}
                      />
                    )}
                  />
                </FormField>
              )}

              <FormField
                htmlFor="status"
                label="상태"
                className="[&>label]:mb-[6px] [&>label]:text-[12.5px] [&>label]:font-bold [&>label]:leading-[normal] [&>label]:text-t2 [&>p]:leading-[normal] [&_.uc-dd-btn]:h-[40px] [&_.uc-dd-btn]:w-full [&_.uc-dd-btn]:justify-between [&_.uc-dd-btn]:rounded-[11px] [&_.uc-dd-btn]:px-[10px] [&_.uc-dd-btn]:text-[14px] [&_.uc-dd-btn]:font-semibold [&_.uc-dd-btn]:leading-[normal] [&_.uc-dd-lbl]:text-[13.5px]"
              >
                <Controller
                  control={control}
                  name="isActive"
                  render={({ field }) => (
                    <CustomDropdown
                      chevron="rotate"
                      ariaLabel="상태"
                      options={STATUS_OPTIONS}
                      value={field.value ? "active" : "inactive"}
                      variant="field"
                      position="fixed"
                      onChange={(value) => field.onChange(value === "active")}
                    />
                  )}
                />
              </FormField>
            </div>

            {!isField && (
              <div>
                <h3 className="mt-[20px] mb-[10px] text-[13px] font-extrabold leading-[normal] text-t2">페이지별 권한</h3>
                {!canEditPermissions && (
                  <p className="mb-2 text-xs leading-[normal] text-t4">마스터 직원만 권한을 변경할 수 있습니다.</p>
                )}
                <Controller
                  control={control}
                  name="permissions"
                  render={({ field }) => (
                    <PermissionChecklist
                      value={field.value ?? []}
                      onChange={field.onChange}
                      disabled={!canEditPermissions}
                      allGranted={selectedMaster}
                    />
                  )}
                />
              </div>
            )}
          </div>

          {errors.root?.server?.message && (
            <p role="alert" className="mt-3 rounded-xl bg-red-t px-3 py-2 text-sm font-semibold leading-[normal] text-red">
              {errors.root.server.message}
            </p>
          )}

          <div className="mt-[18px] flex flex-none items-center gap-[8px]">
            {isEdit && (
              <Button
                type="button"
                variant="danger"
                disabled={submitting}
                onClick={deactivate}
                className="h-[40px] rounded-[11px] border border-[#F04452] bg-[#F04452] px-[15px] text-[13.5px] font-bold leading-[normal] text-white"
              >
                삭제
              </Button>
            )}
            <div className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              onClick={closeSafely}
              disabled={submitting}
              className="h-[40px] rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold leading-[normal] text-t2"
            >
              취소
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="h-[40px] rounded-[11px] border border-brand bg-brand px-[15px] text-[13.5px] font-bold leading-[normal] text-white shadow-[0_6px_14px_-4px_rgba(20,164,151,0.5)]"
            >
              {isEdit ? "저장" : "등록"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
