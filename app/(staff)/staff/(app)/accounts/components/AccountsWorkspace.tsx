"use client";

import React, { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Tabs, SearchBar, Button, EmptyState } from "@/components/common";
import type { StaffType } from "@/hooks/reactquery/auth";
import { useDebouncedValue } from "@/hooks/common";
import {
  useAccounts, useCreateAccount, useUpdateAccountBasic, useUpdatePermissions, useSetActive, useResetPassword,
  type Account, type AccountCreateInput, type AccountBasicInput, type PermissionInput,
} from "@/hooks/reactquery/accounts";
import { AccountTable } from "./AccountTable";
import { AccountFormModal } from "./AccountFormModal";
import { ResidentClaimsPanel } from "./ResidentClaimsPanel";

const TABS = [
  { id: "office", label: "사무실 관리자" },
  { id: "field", label: "현장 관리자" },
  { id: "tenant", label: "입주자" },
];
const TYPES_BY_TAB: Record<string, StaffType[]> = {
  office: ["manager_staff"],
  field: ["field_staff", "support_staff"],
};

export function AccountsWorkspace({ canEditPermissions }: { canEditPermissions: boolean }) {
  const [tab, setTab] = useState("office");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: accounts = [] } = useAccounts({ search: debouncedSearch || undefined });
  const createM = useCreateAccount();
  const basicM = useUpdateAccountBasic();
  const permM = useUpdatePermissions();
  const activeM = useSetActive();
  const resetPasswordM = useResetPassword();

  const filtered = tab === "tenant"
    ? []
    : accounts.filter((account) => TYPES_BY_TAB[tab].includes(account.staffType));

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (a: Account) => { setEditing(a); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const onCreate = async (input: AccountCreateInput) => {
    try {
      const created = await createM.mutateAsync(input);
      toast.success("저장되었습니다");
      return created;
    }
    catch (e) { toast.error(e, "오류가 발생했습니다"); throw e; }
  };
  const onUpdateBasic = async (userId: string, input: AccountBasicInput) => {
    try { await basicM.mutateAsync({ userId, input }); toast.success("저장되었습니다"); }
    catch (e) { toast.error(e, "오류가 발생했습니다"); throw e; }
  };
  const onUpdatePermissions = async (userId: string, input: PermissionInput) => {
    try { await permM.mutateAsync({ userId, input }); }
    catch (e) { toast.error(e, "권한 변경 실패"); throw e; }
  };
  const onResetPassword = async (userId: string, password: string) => {
    try {
      await resetPasswordM.mutateAsync({ userId, password });
      toast.success("변경되었습니다");
    }
    catch (e) { toast.error(e, "오류가 발생했습니다"); throw e; }
  };
  const onSetActive = async (userId: string, active: boolean) => {
    try {
      await activeM.mutateAsync({ userId, active });
      toast.success("변경되었습니다");
    }
    catch (e) { toast.error(e, "오류가 발생했습니다"); throw e; }
  };
  const onToggleActive = async (account: Account) => {
    try {
      await onSetActive(account.userId, !account.isActive);
    } catch {
      // onSetActive shows the error toast.
    }
  };

  return (
    <div className="flex h-full min-h-screen flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-extrabold text-t1">계정·직원 관리</h1>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "tenant" ? (
        <ResidentClaimsPanel />
      ) : (
        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-t1">계정 목록</h2>
              <span className="rounded-lg bg-bg px-2.5 py-1 text-xs font-bold text-t3">
                {filtered.length}개
              </span>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="w-full sm:w-72">
                <SearchBar value={search} onChange={setSearch} placeholder="이름·아이디·연락처 검색" />
              </div>
              <Button type="button" variant="primary" onClick={openCreate} className="shrink-0">
                ＋ 계정 등록
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            {filtered.length === 0 ? (
              <EmptyState message="조건에 맞는 계정이 없습니다" />
            ) : (
              <AccountTable accounts={filtered} onRowClick={openEdit} onToggleActive={onToggleActive} />
            )}
          </div>
        </section>
      )}

      {tab !== "tenant" && (
        <AccountFormModal
          open={modalOpen}
          onClose={closeModal}
          editing={editing}
          createStaffType={tab === "field" ? "field_staff" : "manager_staff"}
          canEditPermissions={canEditPermissions}
          onCreate={onCreate}
          onUpdateBasic={onUpdateBasic}
          onUpdatePermissions={onUpdatePermissions}
          onResetPassword={onResetPassword}
          onSetActive={onSetActive}
          isPending={
            createM.isPending || basicM.isPending || permM.isPending
            || resetPasswordM.isPending || activeM.isPending
          }
        />
      )}
    </div>
  );
}
