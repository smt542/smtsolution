"use client";

import React, { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Tabs, Button, EmptyState, Spinner } from "@/components/common";
import type { StaffType } from "@/hooks/reactquery/auth";
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
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const {
    data: accounts = [],
    isLoading: isAccountListLoading,
    isError: isAccountListError,
    refetch: refetchAccounts,
  } = useAccounts();
  const createM = useCreateAccount();
  const basicM = useUpdateAccountBasic();
  const permM = useUpdatePermissions();
  const activeM = useSetActive();
  const resetPasswordM = useResetPassword();
  const isAccountFormPending = createM.isPending
    || basicM.isPending
    || permM.isPending
    || resetPasswordM.isPending
    || activeM.isPending;

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
  const onSetActive = async (userId: string, active: boolean, successMessage = "변경되었습니다") => {
    try {
      await activeM.mutateAsync({ userId, active });
      toast.success(successMessage);
    }
    catch (e) { toast.error(e, "오류가 발생했습니다"); throw e; }
  };
  return (
    <div className="flex h-[calc(100vh-62px)] min-h-[480px] flex-col overflow-hidden max-md:h-auto max-md:overflow-visible">
      <div className="flex-none border-b border-line bg-surface px-[24px]">
        <Tabs tabs={TABS} active={tab} onChange={setTab} variant="underline" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-hidden px-6 pt-[22px] pb-6">
        {tab === "tenant" ? (
          <ResidentClaimsPanel />
        ) : (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-surface shadow-card">
            <div className="flex flex-none items-center gap-[10px] border-b border-line2 px-[18px] py-[15px]">
              <h2 className="text-[15px] font-extrabold leading-[normal] text-t1">계정 목록</h2>
              <span className="inline-flex items-center rounded-[7px] bg-bg px-[9px] py-[3px] text-[12px] font-bold leading-[1.4] text-t3">
                {filtered.length}개
              </span>
              <div className="flex-1" />
              <Button
                type="button"
                variant="primary"
                onClick={openCreate}
                className="h-[34px] flex-none rounded-[11px] px-[14px] text-[13px] font-bold leading-[normal]"
              >
                ＋ 계정 등록
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {isAccountListLoading ? (
                <div className="flex min-h-[320px] items-center justify-center p-4 leading-[normal]">
                  <Spinner label="계정 목록 불러오는 중" />
                </div>
              ) : isAccountListError ? (
                <div role="alert" className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-4 text-sm leading-[normal] text-danger">
                  <p>계정 목록을 불러오지 못했습니다.</p>
                  <Button type="button" variant="ghost" onClick={() => void refetchAccounts()}>
                    다시 시도
                  </Button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4">
                  <EmptyState message="조건에 맞는 계정이 없습니다" />
                </div>
              ) : (
                <AccountTable
                  accounts={filtered}
                  hideType={tab === "field"}
                  onRowClick={openEdit}
                />
              )}
            </div>
          </section>
        )}
      </div>

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
          isPending={isAccountFormPending}
        />
      )}
    </div>
  );
}
