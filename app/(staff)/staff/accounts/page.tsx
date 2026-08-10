"use client";
import React, { useState } from "react";
import { toast } from "sonner";
import { Tabs, SearchBar, Button, EmptyState } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { canManageAccounts, isMaster } from "@/lib/auth/permissions";
import type { StaffType } from "@/hooks/reactquery/auth";
import {
  useAccounts, useCreateAccount, useUpdateAccountBasic, useUpdatePermissions, useSetActive,
  type Account, type AccountCreateInput, type AccountBasicInput, type PermissionInput,
} from "@/hooks/reactquery/accounts";
import { useStaffRoles } from "@/hooks/reactquery/staffRoles";
import { AccountTable } from "./components/AccountTable";
import { AccountFormModal } from "./components/AccountFormModal";

const TABS = [
  { id: "all", label: "전체" }, { id: "admin", label: "관리자" }, { id: "staff", label: "직원" },
  { id: "field", label: "현장직원" }, { id: "support", label: "스태프" }, { id: "tenant", label: "입주자" },
];
const TYPE_BY_TAB: Record<string, StaffType | undefined> = {
  all: undefined, admin: "manager_staff", staff: "manager_staff",
  field: "field_staff", support: "support_staff", tenant: "tenant",
};

export default function AccountsPage() {
  const { data: me } = useMe();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const type = TYPE_BY_TAB[tab];
  const { data: accounts = [] } = useAccounts({ search: search || undefined, type });
  const { data: roles = [] } = useStaffRoles();
  const createM = useCreateAccount();
  const basicM = useUpdateAccountBasic();
  const permM = useUpdatePermissions();
  const activeM = useSetActive();

  if (!canManageAccounts(me)) {
    return (
      <div className="p-6">
        <EmptyState message="권한이 없습니다" />
      </div>
    );
  }

  // 관리자/직원 탭은 role로 클라이언트 세분 필터
  const filtered = accounts.filter((a) =>
    tab === "admin" ? isMaster(a.role) : tab === "staff" ? !isMaster(a.role) : true);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (a: Account) => { setEditing(a); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const onCreate = async (input: AccountCreateInput) => {
    try { await createM.mutateAsync(input); toast.success("저장되었습니다"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "오류가 발생했습니다"); throw e; }
  };
  const onUpdateBasic = async (userId: string, input: AccountBasicInput) => {
    try { await basicM.mutateAsync({ userId, input }); toast.success("저장되었습니다"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "오류가 발생했습니다"); throw e; }
  };
  const onUpdatePermissions = async (userId: string, input: PermissionInput) => {
    try { await permM.mutateAsync({ userId, input }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "권한 변경 실패"); throw e; }
  };
  const onToggleActive = async (a: Account) => {
    try { await activeM.mutateAsync({ userId: a.userId, active: !a.isActive }); toast.success("변경되었습니다"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "오류가 발생했습니다"); }
  };

  return (
    <div className="flex h-full min-h-screen flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-t1">계정·직원 관리</h1>
        <Button variant="primary" onClick={openCreate}>+ 계정 등록</Button>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="max-w-md">
        <SearchBar value={search} onChange={setSearch} placeholder="이름·아이디·연락처 검색" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="조건에 맞는 계정이 없습니다" />
      ) : (
        <AccountTable accounts={filtered} onRowClick={openEdit} onToggleActive={onToggleActive} />
      )}

      <AccountFormModal
        open={modalOpen}
        onClose={closeModal}
        editing={editing}
        roles={roles}
        canEditPermissions={isMaster(me?.role)}
        onCreate={onCreate}
        onUpdateBasic={onUpdateBasic}
        onUpdatePermissions={onUpdatePermissions}
        isPending={createM.isPending || basicM.isPending || permM.isPending}
      />
    </div>
  );
}
