"use client";

import React from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Input, Modal, Select } from "@/components/common";
import { accountCreateSchema, accountEditSchema } from "@/components/forms/schema/account";
import type {
  Account,
  AccountBasicInput,
  AccountCreateInput,
  PermissionInput,
} from "@/hooks/reactquery/accounts";
import type { StaffType } from "@/hooks/reactquery/auth";
import { PermissionChecklist } from "./PermissionChecklist";

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
  onSetActive: (userId: string, active: boolean) => Promise<void>;
  isPending: boolean;
}

interface FormValues {
  username: string;
  password: string;
  fullName: string;
  phone: string;
  staffType: StaffType;
  isMaster: boolean;
  isActive: boolean;
  permissions: string[];
}

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
  const isEdit = !!editing;
  const isTenant = editing?.staffType === "tenant";
  const modalStaffType = editing?.staffType ?? createStaffType;
  const isField = modalStaffType === "field_staff" || modalStaffType === "support_staff";

  const makeDefaults = React.useCallback(
    (): FormValues =>
      editing
        ? {
            username: editing.username,
            password: "",
            fullName: editing.fullName,
            phone: editing.phone ?? "",
            staffType: editing.staffType,
            isMaster: editing.role === "org_owner" || editing.role === "platform_admin",
            isActive: editing.isActive,
            permissions: editing.permissions,
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
          },
    [createStaffType, editing],
  );

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? accountEditSchema : accountCreateSchema) as unknown as Resolver<FormValues>,
    defaultValues: makeDefaults(),
  });

  React.useEffect(() => {
    if (open) reset(makeDefaults());
  }, [makeDefaults, open, reset]);

  const selectedMaster = useWatch({ control, name: "isMaster" });
  const passwordField = register("password");

  const onValid = async (values: FormValues) => {
    const role = values.isMaster
      ? "org_owner"
      : values.staffType === "field_staff"
        ? "field"
        : "staff";

    if (!isEdit) {
      const created = await onCreate({
        username: values.username,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone || undefined,
        role,
        staffType: values.staffType,
        permissions: values.permissions,
        roleIds: [],
      });
      if (!values.isActive) await onSetActive(created.userId, false);
    } else if (editing) {
      await onUpdateBasic(editing.userId, {
        fullName: values.fullName,
        phone: values.phone || undefined,
        phoneSub: editing.phoneSub || undefined,
        staffType: values.staffType,
        affiliation: editing.affiliation || undefined,
        roleIds: null,
      });
      if (canEditPermissions) {
        await onUpdatePermissions(editing.userId, {
          role,
          staffType: values.staffType,
          permissions: values.permissions,
          roleIds: null,
        });
      }
      if (values.password) await onResetPassword(editing.userId, values.password);
      if (values.isActive !== editing.isActive) {
        await onSetActive(editing.userId, values.isActive);
      }
    }
    onClose();
  };

  const deactivate = async () => {
    if (!editing || !window.confirm("계정을 삭제할까요?")) return;
    try {
      await onSetActive(editing.userId, false);
      onClose();
    } catch {
      // The page handler keeps the modal open and shows the error toast.
    }
  };

  const title = isTenant
    ? "계정 수정"
    : `${isField ? "현장 관리자" : "사무실 관리자"} ${isEdit ? "수정" : "등록"}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      className="max-h-[calc(100vh-2rem)] max-w-3xl overflow-hidden"
    >
      {isTenant ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-t2">
            세입자 계정은 <b>입주자 상세에서</b> 생성·관리합니다. 이 화면에서는 조회·비활성·비밀번호 재설정만 가능합니다.
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>닫기</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onValid)} className="flex max-h-[calc(100vh-7rem)] flex-col">
          <p className="text-sm font-semibold text-t3">필수 항목(*)을 입력해 주세요</p>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="username" className="mb-1 block text-xs font-semibold text-t3">
                  아이디 <RequiredMark />
                </label>
                <Input
                  id="username"
                  aria-label="아이디"
                  {...register("username")}
                  placeholder="아이디 입력"
                  readOnly={isEdit}
                  className={errors.username ? "border-danger" : ""}
                />
                {errors.username && <p className="mt-1 text-xs text-danger">{errors.username.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-xs font-semibold text-t3">
                  비밀번호 {!isEdit && <RequiredMark />}
                </label>
                <Input
                  id="password"
                  aria-label="비밀번호"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]{4}"
                  autoComplete="new-password"
                  required={!isEdit}
                  {...passwordField}
                  onChange={(event) => {
                    event.target.value = event.target.value.replace(/\D/g, "").slice(0, 4);
                    void passwordField.onChange(event);
                  }}
                  placeholder="숫자 4자리"
                  className={errors.password ? "border-danger" : ""}
                />
                {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
              </div>

              <div>
                <label htmlFor="fullName" className="mb-1 block text-xs font-semibold text-t3">
                  이름 <RequiredMark />
                </label>
                <Input
                  id="fullName"
                  aria-label="이름"
                  {...register("fullName")}
                  placeholder="이름 입력"
                  className={errors.fullName ? "border-danger" : ""}
                />
                {errors.fullName && <p className="mt-1 text-xs text-danger">{errors.fullName.message}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="mb-1 block text-xs font-semibold text-t3">연락처</label>
                <Input
                  id="phone"
                  aria-label="연락처"
                  type="tel"
                  inputMode="numeric"
                  {...register("phone")}
                  placeholder="010-0000-0000"
                />
              </div>

              <div>
                <label htmlFor="memberType" className="mb-1 block text-xs font-semibold text-t3">회원 유형</label>
                <Controller
                  control={control}
                  name="isMaster"
                  render={({ field }) => (
                    <Select
                      id="memberType"
                      aria-label="회원 유형"
                      options={MEMBER_TYPE_OPTIONS}
                      value={field.value ? "master" : "normal"}
                      disabled={!canEditPermissions}
                      onChange={(event) => field.onChange(event.target.value === "master")}
                    />
                  )}
                />
              </div>

              <div>
                <label htmlFor="status" className="mb-1 block text-xs font-semibold text-t3">상태</label>
                <Controller
                  control={control}
                  name="isActive"
                  render={({ field }) => (
                    <Select
                      id="status"
                      aria-label="상태"
                      options={STATUS_OPTIONS}
                      value={field.value ? "active" : "inactive"}
                      onChange={(event) => field.onChange(event.target.value === "active")}
                    />
                  )}
                />
              </div>
            </div>

            <div className="mt-5">
              <h3 className="mb-2 text-sm font-extrabold text-t2">페이지별 권한</h3>
              {!canEditPermissions && (
                <p className="mb-2 text-xs text-t4">마스터 직원만 권한을 변경할 수 있습니다.</p>
              )}
              <Controller
                control={control}
                name="permissions"
                render={({ field }) => (
                  <PermissionChecklist
                    value={field.value}
                    onChange={field.onChange}
                    disabled={!canEditPermissions}
                    allGranted={selectedMaster}
                  />
                )}
              />
            </div>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
            {isEdit && (
              <Button type="button" variant="danger" disabled={isPending} onClick={deactivate}>삭제</Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isEdit ? "저장" : "등록"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
