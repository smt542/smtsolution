"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button, Checkbox, EmptyState, Modal, SearchBar, Spinner } from "@/components/common";
import type { PlatformAccountCreateValues } from "@/components/forms/schema/platformAccount";
import {
  useCreatePlatformAccount,
  listPlatformAccounts,
  platformKeys,
  usePlatformResetPassword,
  usePlatformSetActive,
  usePlatformUpdateAccount,
  usePlatformUpdateRole,
  type PlatformAccount,
  type PlatformAccountQuery,
} from "@/hooks/reactquery/platform";
import type { OrgMemberRole, StaffType } from "@/hooks/reactquery/auth";
import { MODULE_KEYS, MODULE_LABELS } from "@/lib/auth/permissions";
import {
  DataScopeNotice,
  PageHeader,
  PlatformPagination,
  QueryError,
} from "../../_components/PageElements";
import type { AccountEditValues } from "./components/AccountEditModal";
import { AccountRowActions } from "./components/AccountRowActions";

const AccountCreateModal = dynamic(() =>
  import("./components/AccountCreateModal").then((module) => module.AccountCreateModal),
);
const AccountEditModal = dynamic(() =>
  import("./components/AccountEditModal").then((module) => module.AccountEditModal),
);

const ROLE_LABELS: Record<PlatformAccount["role"], string> = {
  platform_admin: "플랫폼 관리자",
  org_owner: "조직 소유자",
  manager: "관리자",
  staff: "직원",
  field: "현장 직원",
  tenant: "입주자",
};

type EditableRole = "org_owner" | "manager" | "staff" | "platform_admin";

const ROLE_OPTIONS: Array<{ value: EditableRole; label: string }> = [
  { value: "org_owner", label: "조직 소유자" },
  { value: "manager", label: "관리자" },
  { value: "staff", label: "직원" },
  { value: "platform_admin", label: "플랫폼 관리자(주의)" },
];

const STAFF_TYPE_OPTIONS: Array<{ value: StaffType; label: string }> = [
  { value: "manager_staff", label: "직원(내근)" },
  { value: "field_staff", label: "현장 직원" },
  { value: "support_staff", label: "지원 직원" },
  { value: "tenant", label: "입주자" },
];

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

function useDebouncedValue(value: string) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setDebouncedValue(value),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [value]);

  return debouncedValue;
}

export default function PlatformAccountsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlatformAccount | null>(null);
  const [roleTarget, setRoleTarget] = useState<PlatformAccount | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<{
    username: string;
    tempPassword: string;
  } | null>(null);

  const debouncedSearch = useDebouncedValue(search.trim());
  const query = useMemo<PlatformAccountQuery>(() => ({
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
  }), [debouncedSearch, page]);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: platformKeys.accounts(query),
    queryFn: () => listPlatformAccounts(query),
    placeholderData: keepPreviousData,
  });
  const accounts = data?.rows ?? [];
  const createAccount = useCreatePlatformAccount();
  const updateAccount = usePlatformUpdateAccount();
  const updateRole = usePlatformUpdateRole();
  const setActive = usePlatformSetActive();
  const resetPassword = usePlatformResetPassword();
  const actionPending = updateAccount.isPending
    || updateRole.isPending
    || setActive.isPending
    || resetPassword.isPending;

  const handleCreate = async (values: PlatformAccountCreateValues) => {
    try {
      const result = await createAccount.mutateAsync({
        orgId: values.orgId,
        username: values.username,
        password: values.password ?? "",
        fullName: values.fullName,
        phone: values.phone || null,
        role: values.role,
        staffType: values.staffType,
      });
      if (result.tempPassword) {
        setPasswordNotice({ username: values.username, tempPassword: result.tempPassword });
      }
      toast.success("계정을 발급했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "계정 발급에 실패했습니다.");
      throw error;
    }
  };

  const handleRoleChange = async (values: {
    role: OrgMemberRole;
    staffType: StaffType;
    permissions: string[];
  }) => {
    if (!roleTarget) return;
    try {
      await updateRole.mutateAsync({
        orgId: roleTarget.orgId,
        userId: roleTarget.userId,
        ...values,
      });
      setRoleTarget(null);
      toast.success("계정 권한을 변경했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "권한 변경에 실패했습니다.");
      throw error;
    }
  };

  const handleAccountUpdate = async (values: AccountEditValues) => {
    if (!editTarget) return;
    try {
      await updateAccount.mutateAsync({
        orgId: editTarget.orgId,
        userId: editTarget.userId,
        ...values,
      });
      setEditTarget(null);
      toast.success("계정 정보를 저장했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "계정 정보 저장에 실패했습니다.");
      throw error;
    }
  };

  const handleToggleActive = async (account: PlatformAccount) => {
    try {
      await setActive.mutateAsync({
        orgId: account.orgId,
        userId: account.userId,
        active: !account.isActive,
      });
      toast.success(account.isActive ? "계정을 비활성화했습니다." : "계정을 활성화했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "계정 상태 변경에 실패했습니다.");
    }
  };

  const handleResetPassword = async (account: PlatformAccount) => {
    const password = window.prompt("새 임시 비밀번호를 입력해 주세요. (4자 이상)");
    if (password === null) return;
    if (password.length < 4) {
      toast.error("비밀번호는 4자 이상 입력해 주세요.");
      return;
    }
    try {
      await resetPassword.mutateAsync({ userId: account.userId, password });
      setPasswordNotice({
        username: account.username ?? account.userId,
        tempPassword: password,
      });
      toast.success("비밀번호를 초기화했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "비밀번호 초기화에 실패했습니다.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-5 sm:p-6 lg:p-8">
      <PageHeader
        eyebrow="ACCOUNTS"
        title="계정 관리"
        description="계정 발급·기본 정보·권한·활성·비밀번호를 직접 관리합니다."
      />

      <div className="mt-5">
        <DataScopeNotice />
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-t1">소속 계정 목록</h3>
            <p className="mt-1 text-xs text-t3">총 {(data?.totalCount ?? 0).toLocaleString("ko-KR")}개</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="w-full sm:w-72">
              <SearchBar
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                placeholder="조직·이름·아이디 검색"
              />
            </div>
            <Button type="button" variant="primary" onClick={() => setCreateOpen(true)}>
              + 계정 발급
            </Button>
          </div>
        </div>

        {isPending ? (
          <div className="py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="p-4">
            <QueryError onRetry={() => void refetch()} />
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState message={search ? "검색 결과가 없습니다" : "조회 가능한 계정이 없습니다"} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1420px] text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/70 text-left text-xs font-bold text-t3">
                  <th className="px-5 py-3">계정</th>
                  <th className="px-4 py-3">조직</th>
                  <th className="px-4 py-3">전화번호</th>
                  <th className="px-4 py-3">메모</th>
                  <th className="px-4 py-3">권한</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">소속일</th>
                  <th className="px-5 py-3 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr
                    key={`${account.orgId}:${account.userId}`}
                    className="border-b border-line last:border-0 hover:bg-bg/50"
                  >
                    <td className="px-5 py-4">
                      <div className="font-bold text-t1">{account.fullName ?? "프로필 없음"}</div>
                      <div className="mt-1 text-xs text-t3">{account.username ?? account.userId}</div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-t2">{account.organizationName}</td>
                    <td className="px-4 py-4 text-t2 num">{account.phone ?? "—"}</td>
                    <td className="max-w-64 px-4 py-4 text-t2">
                      <span className="line-clamp-2">{account.memo ?? "—"}</span>
                    </td>
                    <td className="px-4 py-4 text-t2">{ROLE_LABELS[account.role]}</td>
                    <td className="px-4 py-4">
                      <AccountStatus active={account.isActive} />
                    </td>
                    <td className="px-4 py-4 text-t2 num">
                      {dateFormatter.format(new Date(account.createdAt))}
                    </td>
                    <td className="px-5 py-4">
                      <AccountRowActions
                        account={account}
                        onEditDetails={() => setEditTarget(account)}
                        onChangeRole={() => setRoleTarget(account)}
                        onToggleActive={() => void handleToggleActive(account)}
                        onResetPassword={() => void handleResetPassword(account)}
                        isPending={actionPending}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PlatformPagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={data?.totalCount ?? 0}
          onPageChange={setPage}
        />
      </section>

      {createOpen && (
        <AccountCreateModal
          open
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
          isPending={createAccount.isPending}
        />
      )}

      {editTarget && (
        <AccountEditModal
          key={`${editTarget.orgId}:${editTarget.userId}`}
          account={editTarget}
          onClose={() => setEditTarget(null)}
          onSubmit={handleAccountUpdate}
          isPending={updateAccount.isPending}
        />
      )}

      {roleTarget && (
        <RoleChangeModal
          key={`${roleTarget.orgId}:${roleTarget.userId}`}
          account={roleTarget}
          onClose={() => setRoleTarget(null)}
          onSubmit={handleRoleChange}
          isPending={updateRole.isPending}
        />
      )}

      {passwordNotice && (
        <Modal open onClose={() => setPasswordNotice(null)} title="계정 임시 비밀번호">
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-t2">
              아래 계정 정보를 사용자에게 <b>안전하게 전달</b>하세요. 이 창을 닫으면 다시 볼 수
              없습니다.
            </p>
            <div className="rounded-xl border border-line bg-bg/50 p-3 font-mono">
              <div>
                아이디: <b>{passwordNotice.username}</b>
              </div>
              <div>
                임시 비밀번호: <b>{passwordNotice.tempPassword}</b>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  void navigator.clipboard?.writeText(
                    `아이디: ${passwordNotice.username} / 임시비밀번호: ${passwordNotice.tempPassword}`,
                  );
                  toast.success("복사했습니다.");
                }}
              >
                복사
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function AccountStatus({ active }: { active: boolean | null }) {
  if (active === null) {
    return (
      <span className="rounded-full bg-bg px-2.5 py-1 text-[11px] font-bold text-t3">확인 불가</span>
    );
  }
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        active ? "bg-green-t text-green" : "bg-red-t text-red"
      }`}
    >
      {active ? "활성" : "비활성"}
    </span>
  );
}

function RoleChangeModal({
  account,
  onClose,
  onSubmit,
  isPending,
}: {
  account: PlatformAccount;
  onClose: () => void;
  onSubmit: (values: {
    role: OrgMemberRole;
    staffType: StaffType;
    permissions: string[];
  }) => Promise<void>;
  isPending: boolean;
}) {
  const [role, setRole] = useState<EditableRole>(
    account.role === "field" || account.role === "tenant" ? "staff" : account.role,
  );
  const [staffType, setStaffType] = useState<StaffType>(account.staffType);
  const [permissions, setPermissions] = useState<string[]>(account.permissions);

  const handleSubmit = async () => {
    if (
      role === "platform_admin" &&
      account.role !== "platform_admin" &&
      !window.confirm(
        "이 계정에 모든 조직을 관리할 수 있는 플랫폼 관리자 권한을 부여할까요? 매우 높은 권한입니다.",
      )
    ) {
      return;
    }
    if (
      account.role === "platform_admin" &&
      role !== "platform_admin" &&
      !window.confirm("플랫폼 관리자 권한을 해제하고 일반 조직 역할로 강등할까요?")
    ) {
      return;
    }
    await onSubmit({ role, staffType, permissions });
  };

  return (
    <Modal open onClose={onClose} title="계정 권한 변경">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-t2">
          <b>{account.fullName ?? account.username ?? account.userId}</b> · {account.organizationName}
        </p>

        {account.role === "platform_admin" && (
          <p className="rounded-xl bg-red-t px-3 py-2 text-xs font-semibold text-red">
            현재 플랫폼 관리자입니다. 다른 역할을 저장하면 플랫폼 관리자 권한이 해제됩니다.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="platform-role" className="mb-1 block text-xs font-semibold text-t3">
              역할
            </label>
            <select
              id="platform-role"
              value={role}
              onChange={(event) => setRole(event.target.value as EditableRole)}
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-t1"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="platform-staff-type" className="mb-1 block text-xs font-semibold text-t3">
              직원 유형
            </label>
            <select
              id="platform-staff-type"
              value={staffType}
              onChange={(event) => setStaffType(event.target.value as StaffType)}
              className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-t1"
            >
              {STAFF_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-t3">기능별 권한</p>
          <div className="grid grid-cols-2 gap-2">
            {MODULE_KEYS.map((permission) => (
              <Checkbox
                key={permission}
                label={MODULE_LABELS[permission]}
                checked={permissions.includes(permission)}
                onChange={() =>
                  setPermissions((current) =>
                    current.includes(permission)
                      ? current.filter((item) => item !== permission)
                      : [...current, permission],
                  )
                }
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={isPending}
            onClick={() => void handleSubmit()}
          >
            {isPending ? "저장 중…" : "권한 저장"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
