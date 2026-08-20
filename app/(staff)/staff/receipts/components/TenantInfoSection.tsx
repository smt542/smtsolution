"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button, Checkbox, Input, Panel, Spinner } from "@/components/common";
import type { UnitOccupancyFull } from "@/hooks/reactquery/occupancies";
import { useSaveOccupancyFields } from "@/hooks/reactquery/receipts";
import { BILL_DELIVERY_LABEL, TRANSFER_METHOD_LABEL, formatDate } from "../receiptFormat";

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

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-bg px-3 py-2">
      <p className="text-xs font-bold text-t3">{label}</p>
      <p className="mt-1 text-sm font-semibold text-t1">{value}</p>
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  return <span className={value ? "text-blue" : "text-t4"}>{value ? "Y" : "N"}</span>;
}

export function TenantInfoSection({
  data,
  isLoading,
  hasUnit,
  canEdit,
}: {
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
    if (!occ || !form) return;
    try {
      await save.mutateAsync({
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

  const action =
    canEdit && occ !== null ? (
      editing ? (
        <div className="flex gap-1.5">
          <Button type="button" onClick={submit} disabled={save.isPending}>
            저장
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            취소
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" onClick={startEdit}>
          수정
        </Button>
      )
    ) : undefined;

  return (
    <Panel title="입주자정보" action={action}>
      {!hasUnit ? (
        <p className="py-10 text-center text-sm text-t4">호실을 선택하면 입주자정보가 표시돼요</p>
      ) : isLoading ? (
        <Spinner />
      ) : occ === null ? (
        <p className="py-10 text-center text-sm text-t4">등록된 입주자 정보가 없습니다 (공실)</p>
      ) : editing && form ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Field label="입주자명" value={occ.tenantName ?? "-"} />
          <Field label="입금자명" value={occ.payerName ?? "-"} />
          <Field label="전화번호" value={occ.phone ?? "-"} />
          <Field label="적요" value={occ.billingNote ?? "-"} />
          <Field label="입주일" value={formatDate(occ.moveInDate)} />
          <Field label="퇴거일" value={formatDate(occ.moveOutDate)} />
          <Field label="이체방식" value={TRANSFER_METHOD_LABEL[occ.transferMethod] ?? occ.transferMethod} />
          <Field label="고지서 전달" value={BILL_DELIVERY_LABEL[occ.billDelivery] ?? occ.billDelivery} />
          <Field label="문자 동의" value={<YesNo value={occ.smsOptIn} />} />
          <Field label="알림톡 동의" value={<YesNo value={occ.alimtalkOptIn} />} />
          <Field label="부과" value={<YesNo value={occ.billingEnabled} />} />
          <Field label="출력" value={<YesNo value={occ.printEnabled} />} />
        </div>
      )}
    </Panel>
  );
}
