"use client";

import { useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { CustomDropdown, Input, Panel, PhoneInput, Spinner } from "@/components/common";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import { MaskedPhone } from "@/components/common/MaskedPhone";
import { CalendarIcon, CloseIcon } from "@/components/icons";
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

// 보기 모드 = 정본 th min-width + auto layout. 편집 모드는 사용자 결정(2026-09-23 "편집해도 표 폭 유지")으로
// table-layout:fixed + editWidth(%) + 좌우 10px — 1639 창(패널 1013/998)에서 날짜·전화번호가 잘리지 않게 실측으로 나눴다.
const TENANT_COLUMNS = [
  { label: "입주자명", minWidth: 80, editWidth: "7.5%" },
  { label: "입금자명", minWidth: 80, editWidth: "7.5%" },
  { label: "전화번호", minWidth: 118, editWidth: "12.8%" },
  { label: "입주일", minWidth: 92, editWidth: "12.8%" },
  { label: "퇴거일", minWidth: 92, editWidth: "12.8%" },
  { label: "적요", minWidth: 180, editWidth: "14.6%" },
  { label: "문자", minWidth: 60, editWidth: "9.4%" },
  { label: "알림톡", minWidth: 66, editWidth: "9.4%" },
  { label: "부과", minWidth: 48, editWidth: "6.6%" },
  { label: "출력", minWidth: 48, editWidth: "6.6%" },
] as const;

const CONSENT_OPTIONS = [
  { value: "agree", label: "동의" },
  { value: "deny", label: "비동의" },
];
const YES_NO_OPTIONS = [
  { value: "Y", label: "Y" },
  { value: "N", label: "N" },
];

const VIEW_TH_CLASS =
  "sticky top-0 z-[2] whitespace-nowrap border-b border-line bg-[#FBFCFD] px-[16px] py-[11px] text-left text-[12px] font-bold text-t3";
const EDIT_TH_CLASS =
  "sticky top-0 z-[2] whitespace-nowrap border-b border-line bg-[#FBFCFD] px-[10px] py-[11px] text-left text-[12px] font-bold text-t3";
// 굵기·색은 칸마다 하나만 준다(베이스에 두고 뒤에 덧붙이면 CSS 생성 순서가 이긴다).
const VIEW_TD_BASE = "whitespace-nowrap border-b border-line2 px-[16px] py-[12px] text-[13.5px]";
const VIEW_TD_CLASS = `${VIEW_TD_BASE} font-normal text-t1`;
const EDIT_TD_CLASS =
  "whitespace-nowrap border-b border-line2 px-[10px] py-[12px] text-[13.5px] font-normal text-t1";
const MINI_BUTTON_CLASS =
  "inline-flex h-[26px] items-center justify-center gap-[5px] rounded-[8px] border border-line bg-surface px-[10px] text-[11.5px] font-bold leading-[normal] text-t2 hover:border-[#C9D0D8] hover:bg-[#F7F9FA]";
const SAVE_BUTTON_CLASS =
  "inline-flex h-[26px] items-center justify-center gap-[5px] rounded-[8px] border border-teal bg-teal px-[10px] text-[11.5px] font-bold leading-[normal] text-white hover:bg-teal-d disabled:cursor-not-allowed disabled:opacity-60";

function TenantTableHead({ editing = false }: { editing?: boolean }) {
  return (
    <thead>
      <tr>
        {TENANT_COLUMNS.map((column) => (
          <th
            key={column.label}
            className={editing ? EDIT_TH_CLASS : VIEW_TH_CLASS}
            style={editing ? undefined : { minWidth: column.minWidth }}
          >
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TenantTable({ editing, children }: { editing: boolean; children: React.ReactNode }) {
  return (
    <table
      className={editing
        ? "w-full min-w-[960px] table-fixed border-collapse whitespace-nowrap text-[12.5px] leading-[normal]"
        : "w-full table-auto border-collapse whitespace-nowrap text-[12.5px] leading-[normal]"}
    >
      {editing && (
        <colgroup>
          {TENANT_COLUMNS.map((column) => (
            <col key={column.label} style={{ width: column.editWidth }} />
          ))}
        </colgroup>
      )}
      {children}
    </table>
  );
}

function TenantEmptyTable({ message }: { message: string }) {
  return (
    <TenantTable editing={false}>
      <TenantTableHead />
      <tbody className="[&>tr:last-child>td]:border-b-0">
        <tr>
          <td colSpan={TENANT_COLUMNS.length} className="py-[26px] text-center text-[13.5px] text-t1">
            {message}
          </td>
        </tr>
      </tbody>
    </TenantTable>
  );
}

function EmptyOccupancyTable() {
  return (
    <TenantTable editing={false}>
      <TenantTableHead />
      <tbody className="[&>tr:last-child>td]:border-b-0">
        <tr className="hover:[&>td]:bg-row-hover">
          {TENANT_COLUMNS.map((column) => (
            <td key={column.label} className={VIEW_TD_CLASS}>
              -
            </td>
          ))}
        </tr>
      </tbody>
    </TenantTable>
  );
}

function TextCell({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Input
      aria-label={ariaLabel}
      size="26"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function DateCell({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <DpDatePicker
      ariaLabel={ariaLabel}
      className="w-full"
      value={value}
      onChange={onChange}
      placeholder="날짜 선택"
      displayFormatter={(date) => date}
      triggerClassName="flex h-[30px] w-full cursor-pointer items-center justify-between gap-[6px] rounded-[8px] border border-line bg-surface px-[8px] text-[12px] font-semibold text-t1"
      endAdornment={<CalendarIcon className="size-[14px] flex-none text-[#8B95A1] stroke-[1.9]" aria-hidden="true" />}
    />
  );
}

function ConsentCell({ value, onChange, ariaLabel }: { value: boolean; onChange: (value: boolean) => void; ariaLabel: string }) {
  return (
    <CustomDropdown
      ariaLabel={ariaLabel}
      size="cell"
      position="fixed"
      menuMinWidth={96}
      value={value ? "agree" : "deny"}
      options={CONSENT_OPTIONS}
      onChange={(nextValue) => onChange(nextValue === "agree")}
    />
  );
}

function YesNoCell({ value, onChange, ariaLabel }: { value: boolean; onChange: (value: boolean) => void; ariaLabel: string }) {
  return (
    <CustomDropdown
      ariaLabel={ariaLabel}
      size="cell"
      position="fixed"
      menuMinWidth={96}
      value={value ? "Y" : "N"}
      options={YES_NO_OPTIONS}
      onChange={(nextValue) => onChange(nextValue === "Y")}
    />
  );
}

function getMidMonthMoveOutDay(moveOutDate: string | null, period: string): number | null {
  const date = moveOutDate?.slice(0, 10) ?? "";
  // period 는 'YYYY-MM-01' 이다(lib/billing/period).
  const ym = period.slice(0, 7);
  const periodMatch = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!date || date.slice(0, 7) !== ym || !periodMatch) return null;

  const day = Number(date.slice(8, 10));
  const year = Number(periodMatch[1]);
  const month = Number(periodMatch[2]);
  const lastDay = new Date(year, month, 0).getDate();
  return day > 0 && day < lastDay ? day : null;
}

export function TenantInfoSection({
  orgId,
  buildingId,
  period,
  data,
  isLoading,
  hasUnit,
  canEdit,
  maskReadOnlyPhone,
}: {
  orgId: number;
  buildingId: number | null;
  period: string;
  data: UnitOccupancyFull | undefined;
  isLoading: boolean;
  hasUnit: boolean;
  canEdit: boolean;
  maskReadOnlyPhone?: boolean;
}) {
  const occ = data?.occupancy ?? null;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const save = useSaveOccupancyFields();

  const startEdit = () => {
    if (!occ) {
      if (hasUnit) toast.warning("공실 세대는 입주자 등록 후 수정할 수 있어요");
      return;
    }
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

  const cancelEdit = () => {
    setEditing(false);
    setForm(null);
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
      toast.success("입주자정보를 저장했어요");
      setEditing(false);
      setForm(null);
    } catch (error) {
      toast.error(error, "저장하지 못했어요");
    }
  };

  const patch = (next: Partial<FormState>) => setForm((previous) => (previous ? { ...previous, ...next } : previous));

  const action = canEdit ? (
    editing ? (
      <div className="flex items-center gap-[10px]">
        <button
          type="button"
          onClick={submit}
          disabled={save.isPending}
          className={SAVE_BUTTON_CLASS}
        >
          {save.isPending ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          title="취소"
          aria-label="취소"
          onClick={cancelEdit}
          className="inline-flex size-[26px] items-center justify-center p-0 text-t3 hover:text-t2"
        >
          <CloseIcon className="size-[14px] stroke-[2.2]" aria-hidden="true" />
        </button>
      </div>
    ) : (
      <button type="button" onClick={startEdit} className={MINI_BUTTON_CLASS}>
        수정
      </button>
    )
  ) : undefined;

  const midMonthMoveOutDay = !editing ? getMidMonthMoveOutDay(occ?.moveOutDate ?? null, period) : null;
  const rowClassName = "hover:[&>td]:bg-row-hover";

  return (
    <Panel title="입주자정보" action={action} flush className="max-h-[210px] shrink-0">
      {!hasUnit ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <TenantEmptyTable message="호실을 선택하면 입주자정보가 표시돼요" />
        </div>
      ) : isLoading ? (
        <div className="flex h-[106px] items-center justify-center">
          <Spinner label="입주자 정보 불러오는 중" />
        </div>
      ) : occ === null ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <EmptyOccupancyTable />
        </div>
      ) : editing && form ? (
        <div className="min-h-0 flex-1 overflow-auto">
          <TenantTable editing>
            <TenantTableHead editing />
            <tbody className="[&>tr:last-child>td]:border-b-0">
              <tr className={rowClassName}>
                <td className={EDIT_TD_CLASS}>
                  <TextCell ariaLabel="입주자명" value={form.tenantName} onChange={(value) => patch({ tenantName: value })} />
                </td>
                <td className={EDIT_TD_CLASS}>
                  <TextCell ariaLabel="입금자명" value={form.payerName} onChange={(value) => patch({ payerName: value })} />
                </td>
                <td className={EDIT_TD_CLASS}>
                  <PhoneInput
                    aria-label="전화번호"
                    size="26"
                    value={form.phone}
                    onChange={(event) => patch({ phone: event.target.value })}
                  />
                </td>
                <td className={EDIT_TD_CLASS}>
                  <DateCell ariaLabel="입주일" value={form.moveInDate} onChange={(value) => patch({ moveInDate: value })} />
                </td>
                <td className={EDIT_TD_CLASS}>
                  <DateCell ariaLabel="퇴거일" value={form.moveOutDate} onChange={(value) => patch({ moveOutDate: value })} />
                </td>
                <td className={EDIT_TD_CLASS}>
                  <TextCell ariaLabel="적요" value={form.note} onChange={(value) => patch({ note: value })} />
                </td>
                <td className={EDIT_TD_CLASS}>
                  <ConsentCell ariaLabel="문자" value={form.smsOptIn} onChange={(value) => patch({ smsOptIn: value })} />
                </td>
                <td className={EDIT_TD_CLASS}>
                  <ConsentCell ariaLabel="알림톡" value={form.alimtalkOptIn} onChange={(value) => patch({ alimtalkOptIn: value })} />
                </td>
                <td className={EDIT_TD_CLASS}>
                  <YesNoCell ariaLabel="부과" value={form.billingEnabled} onChange={(value) => patch({ billingEnabled: value })} />
                </td>
                <td className={EDIT_TD_CLASS}>
                  <YesNoCell ariaLabel="출력" value={form.printEnabled} onChange={(value) => patch({ printEnabled: value })} />
                </td>
              </tr>
            </tbody>
          </TenantTable>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <TenantTable editing={false}>
            <TenantTableHead />
            <tbody className="[&>tr:last-child>td]:border-b-0">
              <tr className={rowClassName}>
                <td className={`${VIEW_TD_CLASS}${midMonthMoveOutDay ? " shadow-[inset_3px_0_0_var(--color-amber)]" : ""}`}>
                  {occ.tenantName || "-"}
                </td>
                <td className={VIEW_TD_CLASS}>{occ.payerName || "-"}</td>
                <td className={`${VIEW_TD_CLASS} num [&_button]:py-0 [&_button]:leading-[normal]`}>
                  {occ.phone && maskReadOnlyPhone ? (
                    <MaskedPhone
                      value={occ.phone}
                      kind="phone"
                      reveal={{ targetKind: "occupancy", targetId: occ.id, field: "phone" }}
                    />
                  ) : (
                    occ.phone || "-"
                  )}
                </td>
                <td className={`${VIEW_TD_CLASS} num`}>{formatDate(occ.moveInDate)}</td>
                <td
                  className={`${VIEW_TD_BASE} num ${midMonthMoveOutDay ? "font-bold text-amber" : "font-normal text-t1"}`}
                  title={midMonthMoveOutDay ? `중도퇴실 · 재실 ${midMonthMoveOutDay}일` : undefined}
                >
                  {formatDate(occ.moveOutDate)}
                </td>
                <td className={VIEW_TD_CLASS} title={occ.billingNote || "-"}>{occ.billingNote || "-"}</td>
                <td className={VIEW_TD_CLASS}>{occ.smsOptIn ? "동의" : "비동의"}</td>
                <td className={VIEW_TD_CLASS}>{occ.alimtalkOptIn ? "동의" : "비동의"}</td>
                <td className={VIEW_TD_CLASS}>{occ.billingEnabled ? "Y" : "N"}</td>
                <td className={VIEW_TD_CLASS}>{occ.printEnabled ? "Y" : "N"}</td>
              </tr>
            </tbody>
          </TenantTable>
        </div>
      )}
    </Panel>
  );
}
