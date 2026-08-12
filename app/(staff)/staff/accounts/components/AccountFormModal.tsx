"use client";
import React from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal, Input, Select, Button } from "@/components/common";
import { accountCreateSchema, accountEditSchema } from "@/components/forms/schema/account";
import { PermissionChecklist } from "./PermissionChecklist";
import { StaffRoleSelect } from "./StaffRoleSelect";
import type { StaffRole } from "@/hooks/reactquery/staffRoles";
import type {
  Account, AccountCreateInput, AccountBasicInput, PermissionInput,
} from "@/hooks/reactquery/accounts";
import type { StaffType } from "@/hooks/reactquery/auth";

const STAFF_TYPE_OPTIONS: { value: StaffType; label: string }[] = [
  { value: "manager_staff", label: "직원(내근)" },
  { value: "field_staff", label: "현장직원" },
  { value: "support_staff", label: "스태프(청소·관리실 등)" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  editing: Account | null;
  roles: StaffRole[];
  canEditPermissions: boolean;
  onCreate: (input: AccountCreateInput) => Promise<void>;
  onUpdateBasic: (userId: string, input: AccountBasicInput) => Promise<void>;
  onUpdatePermissions: (userId: string, input: PermissionInput) => Promise<void>;
  isPending: boolean;
}

interface FormValues {
  username: string; password: string; fullName: string;
  phone: string; phoneSub: string; staffType: StaffType;
  isMaster: boolean; affiliation: string; permissions: string[]; roleIds: number[];
}

export function AccountFormModal({
  open, onClose, editing, roles, canEditPermissions,
  onCreate, onUpdateBasic, onUpdatePermissions, isPending,
}: Props) {
  const isEdit = !!editing;
  const isTenant = editing?.staffType === "tenant";

  const makeDefaults = (): FormValues =>
    editing
      ? {
          username: editing.username, password: "", fullName: editing.fullName,
          phone: editing.phone ?? "", phoneSub: editing.phoneSub ?? "",
          staffType: editing.staffType, isMaster: editing.role === "org_owner" || editing.role === "platform_admin",
          affiliation: editing.affiliation ?? "", permissions: editing.permissions,
          roleIds: [],
        }
      : {
          username: "", password: "", fullName: "", phone: "", phoneSub: "",
          staffType: "manager_staff", isMaster: false, affiliation: "", permissions: [], roleIds: [],
        };

  const { register, control, handleSubmit, watch, reset, formState: { errors } } =
    useForm<FormValues>({
      resolver: zodResolver(isEdit ? accountEditSchema : accountCreateSchema) as unknown as Resolver<FormValues>,
      defaultValues: makeDefaults(),
    });

  React.useEffect(() => {
    if (open) reset(makeDefaults());
  }, [open, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const staffType = Reflect.apply(
    watch as unknown as (name: "staffType") => StaffType,
    undefined,
    ["staffType"],
  );
  const isMaster = Reflect.apply(
    watch as unknown as (name: "isMaster") => boolean,
    undefined,
    ["isMaster"],
  );
  const showPermissions = staffType === "manager_staff";

  const onValid = async (v: FormValues) => {
    const role = v.isMaster ? "org_owner" : v.staffType === "field_staff" ? "field" : "staff";
    if (!isEdit) {
      await onCreate({
        username: v.username, password: v.password, fullName: v.fullName,
        phone: v.phone || undefined, phoneSub: v.phoneSub || undefined,
        role, staffType: v.staffType, permissions: showPermissions ? v.permissions : [],
        affiliation: v.affiliation || undefined, roleIds: v.roleIds,
      });
    } else if (editing) {
      await onUpdateBasic(editing.userId, {
        fullName: v.fullName, phone: v.phone || undefined, phoneSub: v.phoneSub || undefined,
        staffType: v.staffType, affiliation: v.affiliation || undefined, roleIds: null,
      });
      if (canEditPermissions && showPermissions) {
        await onUpdatePermissions(editing.userId, {
          role, staffType: v.staffType, permissions: v.permissions, roleIds: null,
        });
      }
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "계정 수정" : "계정 등록"}>
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
        <form onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
          {/* 이름 */}
          <div>
            <label htmlFor="fullName" className="mb-1 block text-xs font-semibold text-t3">이름</label>
            <Input id="fullName" {...register("fullName")} placeholder="예: 김직원"
              className={errors.fullName ? "border-danger" : ""} />
            {errors.fullName && <p className="mt-1 text-xs text-danger">{errors.fullName.message as string}</p>}
          </div>

          {/* 연락처 주/부 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="phone" className="mb-1 block text-xs font-semibold text-t3">연락처(주)</label>
              <Input id="phone" {...register("phone")} placeholder="010-0000-0000" />
            </div>
            <div>
              <label htmlFor="phoneSub" className="mb-1 block text-xs font-semibold text-t3">연락처(부)</label>
              <Input id="phoneSub" {...register("phoneSub")} placeholder="선택" />
            </div>
          </div>

          {/* 유형 */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-t3">유형</label>
            <Controller control={control} name="staffType" render={({ field }) => (
              <Select options={STAFF_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={field.value} onChange={(e) => field.onChange(e.target.value as StaffType)} />
            )} />
          </div>

          {/* 아이디·비밀번호 (등록 시만) */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="username" className="mb-1 block text-xs font-semibold text-t3">아이디</label>
                <Input id="username" {...register("username")} placeholder="영문 아이디"
                  className={errors.username ? "border-danger" : ""} />
                {errors.username && <p className="mt-1 text-xs text-danger">{errors.username.message as string}</p>}
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-xs font-semibold text-t3">비밀번호</label>
                <Input id="password" type="password" {...register("password")} placeholder="4자 이상"
                  className={errors.password ? "border-danger" : ""} />
                {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message as string}</p>}
              </div>
            </div>
          )}

          {/* 소속 (스태프 유형) */}
          {staffType === "support_staff" && (
            <div>
              <label htmlFor="affiliation" className="mb-1 block text-xs font-semibold text-t3">소속</label>
              <Input id="affiliation" {...register("affiliation")} placeholder="예: A청소팀" />
            </div>
          )}

          {/* 담당역할 */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-t3">담당역할</label>
            {isEdit ? (
              <>
                <p className="text-sm text-t2">
                  {editing?.roleLabels?.length ? editing.roleLabels.join(", ") : "-"}
                </p>
                <p className="mt-1 text-xs text-t4">담당역할 변경은 준비 중입니다.</p>
              </>
            ) : (
              <Controller control={control} name="roleIds" render={({ field }) => (
                <StaffRoleSelect roles={roles} value={field.value} onChange={field.onChange} />
              )} />
            )}
          </div>

          {/* 마스터 + 권한 (manager_staff) */}
          {showPermissions && (
            <div className="flex flex-col gap-2 border-t border-line pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-brand disabled:opacity-70"
                  {...register("isMaster")} disabled={!canEditPermissions} />
                <span>마스터 직원(관리자) — 전체 권한</span>
              </label>
              <p className="text-xs font-semibold text-t3">기능별 권한</p>
              {!canEditPermissions && <p className="text-xs text-t4">마스터 직원만 권한을 변경할 수 있습니다.</p>}
              <Controller control={control} name="permissions" render={({ field }) => (
                <PermissionChecklist value={field.value} onChange={field.onChange}
                  disabled={!canEditPermissions} allGranted={isMaster} />
              )} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>취소</Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "저장 중…" : isEdit ? "수정" : "등록"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
