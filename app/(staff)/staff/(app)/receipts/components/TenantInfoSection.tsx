"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Checkbox, Input, Panel, Spinner } from "@/components/common";
import type { UnitOccupancyFull } from "@/hooks/reactquery/occupancies";
import { useSaveOccupancyFields } from "@/hooks/reactquery/receipts";
import { formatDate } from "../receiptFormat";

interface FormState {
  tenantName: string;
  payerName: string;
  phone: string;
  moveInDate: string;
  moveOutDate: string;
  note: string;
  billingEnabled: boolean;
  printEnabled: boolean;
  smsOptIn: boolean;
  alimtalkOptIn: boolean;
}

function YesNo({ value }: { value: boolean }) {
  return <span className={value ? "text-t1" : "text-t4"}>{value ? "Y" : "N"}</span>;
}

const TENANT_COLUMNS = [
  "입주자명",
  "입금자명",
  "전화번호",
  "입주일",
  "퇴거일",
  "적요",
  "문자",
  "알림톡",
  "부과",
  "출력",
];
const TENANT_COLUMN_WIDTHS = [80, 80, 118, 92, 92, 180, 60, 66, 48, 48];

function TenantTableHead() {
  return (
    <thead>
      <tr className="border-b border-line bg-[#FBFCFD] text-left text-[12px] font-bold leading-[normal] text-t3">
        {TENANT_COLUMNS.map((label, index) => (
          <th key={label} className="px-[16px] py-[11px]" style={{ minWidth: TENANT_COLUMN_WIDTHS[index] }}>
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TenantEmptyTable({ message }: { message: string }) {
  return (
    <table className="w-full whitespace-nowrap text-[13.5px] leading-[normal]">
      <TenantTableHead />
      <tbody>
        <tr>
          <td colSpan={TENANT_COLUMNS.length} className="pb-[27px] pt-[26px] text-center text-[13.5px] text-t1">
            {message}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function TenantInfoSection({
  orgId,
  buildingId,
  period,
  data,
  isLoading,
  hasUnit,
  canEdit,
}: {
  orgId: number;
  buildingId: number | null;
  period: string;
  data: UnitOccupancyFull | undefined;
  isLoading: boolean;
  hasUnit: boolean;
  canEdit: boolean;
}) {
  const occ = data?.occupancy ?? null;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const save = useSaveOccupancyFields();

  const startEdit = () => {
    if (!occ) return;
    setForm({
      tenantName: occ.tenantName ?? "",
      payerName: occ.payerName ?? "",
      phone: occ.phone ?? "",
      moveInDate: occ.moveInDate?.slice(0, 10) ?? "",
      moveOutDate: occ.moveOutDate?.slice(0, 10) ?? "",
      note: occ.billingNote ?? "",
      billingEnabled: occ.billingEnabled,
      printEnabled: occ.printEnabled,
      smsOptIn: occ.smsOptIn,
      alimtalkOptIn: occ.alimtalkOptIn,
    });
    setEditing(true);
  };

  const submit = async () => {
    if (!occ || !form || buildingId === null) return;
    try {
      await save.mutateAsync({
        orgId,
        buildingId,
        unitId: occ.unitId,
        period,
        occupancyId: occ.id,
        tenantName: form.tenantName,
        payerName: form.payerName,
        phone: form.phone,
        moveInDate: form.moveInDate || null,
        moveOutDate: form.moveOutDate || null,
        note: form.note,
        billingEnabled: form.billingEnabled,
        printEnabled: form.printEnabled,
        smsOptIn: form.smsOptIn,
        alimtalkOptIn: form.alimtalkOptIn,
      });
      toast.success("입주자 정보를 저장했습니다.");
      setEditing(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    }
  };

  const patch = (next: Partial<FormState>) => setForm((prev) => (prev ? { ...prev, ...next } : prev));

  const action = canEdit ? (
    editing ? (
      <div className="flex gap-[6px]">
        <button
          type="button"
          onClick={submit}
          disabled={save.isPending}
          className="h-[26px] rounded-[8px] border border-teal bg-teal px-[10px] text-[11.5px] font-bold text-white disabled:opacity-60"
        >
          저장
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="h-[26px] rounded-[8px] border border-line bg-surface px-[10px] text-[11.5px] font-bold text-t2 hover:bg-bg"
        >
          취소
        </button>
      </div>
    ) : (
      <button
        type="button"
        onClick={startEdit}
        className="h-[26px] rounded-[8px] border border-line bg-surface px-[10px] text-[11.5px] font-bold leading-[normal] text-t2 hover:bg-bg"
      >
        수정
      </button>
    )
  ) : undefined;

  return (
    <Panel title="입주자정보" action={action} flush className="max-h-[210px] shrink-0">
      {!hasUnit ? (
        <div className="overflow-x-auto">
          <TenantEmptyTable message="호실을 선택하면 입주자정보가 표시돼요" />
        </div>
      ) : isLoading ? (
        <div className="flex h-[106px] items-center justify-center"><Spinner /></div>
      ) : occ === null ? (
        <div className="overflow-x-auto">
          <TenantEmptyTable message="등록된 입주자 정보가 없습니다 (공실)" />
        </div>
      ) : editing && form ? (
        <div className="grid grid-cols-2 gap-3 p-[18px] md:grid-cols-4">
          <label className="text-xs font-bold text-t3">
            입주자명
            <Input
              className="mt-1"
              value={form.tenantName}
              onChange={(e) => patch({ tenantName: e.target.value })}
            />
          </label>
          <label className="text-xs font-bold text-t3">
            입금자명
            <Input
              className="mt-1"
              value={form.payerName}
              onChange={(e) => patch({ payerName: e.target.value })}
            />
          </label>
          <label className="text-xs font-bold text-t3">
            전화번호
            <Input
              className="mt-1"
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
            />
          </label>
          <label className="text-xs font-bold text-t3">
            적요
            <Input
              className="mt-1"
              value={form.note}
              onChange={(e) => patch({ note: e.target.value })}
            />
          </label>
          <label className="text-xs font-bold text-t3">
            입주일
            <Input
              type="date"
              className="mt-1"
              value={form.moveInDate}
              onChange={(e) => patch({ moveInDate: e.target.value })}
            />
          </label>
          <label className="text-xs font-bold text-t3">
            퇴거일
            <Input
              type="date"
              className="mt-1"
              value={form.moveOutDate}
              onChange={(e) => patch({ moveOutDate: e.target.value })}
            />
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-bg px-3 py-2 md:col-span-4">
            <Checkbox
              label="문자 수신동의"
              checked={form.smsOptIn}
              onChange={(e) => patch({ smsOptIn: e.target.checked })}
            />
            <Checkbox
              label="알림톡 수신동의"
              checked={form.alimtalkOptIn}
              onChange={(e) => patch({ alimtalkOptIn: e.target.checked })}
            />
            <Checkbox
              label="부과"
              checked={form.billingEnabled}
              onChange={(e) => patch({ billingEnabled: e.target.checked })}
            />
            <Checkbox
              label="출력"
              checked={form.printEnabled}
              onChange={(e) => patch({ printEnabled: e.target.checked })}
            />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13.5px] leading-[normal]">
            <TenantTableHead />
            <tbody>
              <tr className="text-t2">
                <td className="px-[16px] py-[26px]">{occ.tenantName ?? "-"}</td>
                <td className="px-[16px] py-[26px]">{occ.payerName ?? "-"}</td>
                <td className="px-[16px] py-[26px]">{occ.phone ?? "-"}</td>
                <td className="px-[16px] py-[26px]">{formatDate(occ.moveInDate)}</td>
                <td className="px-[16px] py-[26px]">{formatDate(occ.moveOutDate)}</td>
                <td className="truncate px-[16px] py-[26px]" title={occ.billingNote ?? "-"}>{occ.billingNote ?? "-"}</td>
                <td className="px-[16px] py-[26px]"><YesNo value={occ.smsOptIn} /></td>
                <td className="px-[16px] py-[26px]"><YesNo value={occ.alimtalkOptIn} /></td>
                <td className="px-[16px] py-[26px]"><YesNo value={occ.billingEnabled} /></td>
                <td className="px-[16px] py-[26px]"><YesNo value={occ.printEnabled} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
