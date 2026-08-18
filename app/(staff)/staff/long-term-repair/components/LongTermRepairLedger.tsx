"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Spinner } from "@/components/common";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  useLongTermRepairLedger,
  useLongTermRepairOpeningBalance,
  useSaveLongTermRepairLedger,
  type LongTermRepairLedgerEntry,
} from "@/hooks/reactquery/longTermRepair";
import {
  useAttachmentsByEntities,
  useDeleteAttachment,
  useUploadAttachment,
  type Attachment,
} from "@/hooks/reactquery/attachments";
import { AttachmentViewer } from "./AttachmentViewer";
import { CustomDropdown } from "./CustomDropdown";
import {
  LongTermRepairPrintView,
  type LongTermRepairPrintRow,
} from "./LongTermRepairPrintView";

const LEDGER_ENTITY_TYPE = "long_term_repair_ledger";

interface DraftLedgerRow {
  clientKey: string;
  id?: number;
  entryDate: string;
  entryNo: string;
  fundNote: string;
  deposit: number;
  withdrawal: number;
  balance: number;
  memo: string;
}

interface ViewerState {
  title: string;
  attachments: Attachment[];
}

interface LongTermRepairLedgerProps {
  orgId: number;
  companyName: string;
  buildings: Building[];
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const value = String(index + 1).padStart(2, "0");
  return { value, label: `${value}월` };
});

function currentDateValue() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function defaultEntryDate(startMonth: string, endMonth: string) {
  const today = currentDateValue();
  const start = `${startMonth}-01`;
  const end = monthEnd(endMonth);
  if (today >= start && today <= end) return today;
  return end;
}

function toDraft(row: LongTermRepairLedgerEntry): DraftLedgerRow {
  return {
    clientKey: `row-${row.id}`,
    id: row.id,
    entryDate: row.entryDate,
    entryNo: row.entryNo,
    fundNote: row.fundNote,
    deposit: row.deposit,
    withdrawal: row.withdrawal,
    balance: row.balance,
    memo: row.memo ?? "",
  };
}

function compareRows(a: DraftLedgerRow, b: DraftLedgerRow) {
  return a.entryDate.localeCompare(b.entryDate)
    || a.entryNo.localeCompare(b.entryNo, "ko-KR", { numeric: true })
    || (a.id ?? Number.MAX_SAFE_INTEGER) - (b.id ?? Number.MAX_SAFE_INTEGER)
    || a.clientKey.localeCompare(b.clientKey);
}

export function recalculateLedgerRows(rows: DraftLedgerRow[], openingBalance: number) {
  let balance = openingBalance;
  return [...rows].sort(compareRows).map((row) => {
    balance += row.deposit - row.withdrawal;
    return { ...row, balance };
  });
}

function formatMoney(value: number) {
  return value.toLocaleString("ko-KR");
}

function parseAmount(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

function nextEntryNo(rows: DraftLedgerRow[]) {
  const max = rows.reduce((current, row) => {
    const parsed = Number.parseInt(row.entryNo, 10);
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current;
  }, 0);
  return String(max + 1).padStart(3, "0");
}

function AttachmentCell({
  label,
  kind,
  row,
  attachments,
  editing,
  uploading,
  onOpen,
  onUpload,
}: {
  label: string;
  kind: "receipt" | "photo";
  row: DraftLedgerRow;
  attachments: Attachment[];
  editing: boolean;
  uploading: boolean;
  onOpen: () => void;
  onUpload: (file: File) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex min-w-20 items-center justify-center gap-1">
      <button
        type="button"
        className={`rounded-md px-1.5 py-1 text-xs font-bold ${attachments.length ? "bg-blue-t text-blue-d hover:bg-blue-t2" : "text-t4"}`}
        disabled={attachments.length === 0}
        onClick={onOpen}
        aria-label={`${label} ${attachments.length}장 열기`}
      >
        {attachments.length ? `${attachments.length}장` : "-"}
      </button>
      {editing && row.id && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label={`${label} 이미지 첨부`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onUpload(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={uploading}
            className="rounded-md border border-line px-1.5 py-1 text-[11px] font-bold text-t2 hover:border-blue hover:text-blue disabled:opacity-50"
            onClick={() => fileRef.current?.click()}
          >
            첨부
          </button>
        </>
      )}
      {editing && !row.id && <span className="text-[10px] text-t4">저장 후 첨부</span>}
      <span className="sr-only">{kind}</span>
    </div>
  );
}

export function LongTermRepairLedger({ orgId, companyName, buildings }: LongTermRepairLedgerProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const initialEndMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [startMonth, setStartMonth] = useState(`${currentYear}-01`);
  const [endMonth, setEndMonth] = useState(initialEndMonth);
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftRows, setDraftRows] = useState<DraftLedgerRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const tempKey = useRef(0);

  const ledgerQuery = useLongTermRepairLedger(buildingId, startMonth, endMonth);
  const openingBalanceQuery = useLongTermRepairOpeningBalance(buildingId, startMonth);
  const saveLedger = useSaveLongTermRepairLedger();
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const serverRows = ledgerQuery.data ?? [];
  const persistedIds = (editing ? draftRows : serverRows.map(toDraft))
    .flatMap((row) => row.id ? [row.id] : []);
  const attachmentQuery = useAttachmentsByEntities(LEDGER_ENTITY_TYPE, persistedIds);

  const openingBalance = openingBalanceQuery.data
    ?? (serverRows[0] ? serverRows[0].balance - serverRows[0].deposit + serverRows[0].withdrawal : 0);
  const displayRows = editing
    ? recalculateLedgerRows(draftRows, openingBalance)
    : serverRows.map(toDraft);
  const selectedBuilding = buildings.find((building) => building.id === buildingId) ?? null;
  const depositTotal = displayRows.reduce((sum, row) => sum + row.deposit, 0);
  const withdrawalTotal = displayRows.reduce((sum, row) => sum + row.withdrawal, 0);
  const currentBalance = displayRows.at(-1)?.balance ?? openingBalance;

  const yearOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const value = String(currentYear + 1 - index);
    return { value, label: `${value}년` };
  }), [currentYear]);

  const attachmentsByRow = useMemo(() => {
    const grouped = new Map<number, Attachment[]>();
    for (const attachment of attachmentQuery.data ?? []) {
      const current = grouped.get(attachment.entityId) ?? [];
      current.push(attachment);
      grouped.set(attachment.entityId, current);
    }
    return grouped;
  }, [attachmentQuery.data]);

  const enterEdit = () => {
    if (!buildingId) return;
    setDraftRows(serverRows.map(toDraft));
    setDeletedIds([]);
    setDirty(false);
    setEditing(true);
    toast.success("내역을 수정할 수 있어요");
  };

  const addRow = () => {
    if (!buildingId) {
      toast.error("건물을 먼저 선택해 주세요");
      return;
    }
    const baseRows = editing ? draftRows : serverRows.map(toDraft);
    tempKey.current += 1;
    setDraftRows([...baseRows, {
      clientKey: `new-${tempKey.current}`,
      entryDate: defaultEntryDate(startMonth, endMonth),
      entryNo: nextEntryNo(baseRows),
      fundNote: "",
      deposit: 0,
      withdrawal: 0,
      balance: currentBalance,
      memo: "",
    }]);
    setDeletedIds(editing ? deletedIds : []);
    setEditing(true);
    setDirty(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDirty(false);
    setDraftRows([]);
    setDeletedIds([]);
    toast.success("변경을 취소했어요");
  };

  const updateRow = (clientKey: string, patch: Partial<DraftLedgerRow>) => {
    setDraftRows((current) => current.map((row) => row.clientKey === clientKey ? { ...row, ...patch } : row));
    setDirty(true);
  };

  const removeRow = (row: DraftLedgerRow) => {
    if (!window.confirm("행을 삭제할까요?")) return;
    setDraftRows((current) => current.filter((candidate) => candidate.clientKey !== row.clientKey));
    if (row.id) setDeletedIds((current) => [...new Set([...current, row.id as number])]);
    setDirty(true);
    toast.success("행을 삭제했어요");
  };

  const persist = async () => {
    if (!buildingId || !dirty) return;
    if (draftRows.some((row) => !/^\d{4}-\d{2}-\d{2}$/.test(row.entryDate))) {
      toast.error("일자를 입력해 주세요");
      return;
    }
    if (draftRows.some((row) => !row.fundNote.trim())) {
      toast.error("적립금 적요를 입력해 주세요");
      return;
    }
    if (draftRows.some((row) => !Number.isSafeInteger(row.deposit) || !Number.isSafeInteger(row.withdrawal))) {
      toast.error("금액이 너무 큽니다");
      return;
    }
    try {
      await saveLedger.mutateAsync({
        buildingId,
        rows: draftRows.map((row) => ({
          id: row.id,
          entryDate: row.entryDate,
          entryNo: row.entryNo.trim(),
          fundNote: row.fundNote.trim(),
          deposit: row.deposit,
          withdrawal: row.withdrawal,
          memo: row.memo.trim() || null,
        })),
        deletedIds,
      });
      setEditing(false);
      setDirty(false);
      setDraftRows([]);
      setDeletedIds([]);
      toast.success("적립금 내역을 저장했어요");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "적립금 내역을 저장하지 못했습니다.");
    }
  };

  const print = () => {
    if (!buildingId) {
      toast.error("건물을 먼저 선택해 주세요");
      return;
    }
    if (displayRows.length === 0) {
      toast.error("출력할 내역이 없어요");
      return;
    }
    window.print();
  };

  const upload = async (row: DraftLedgerRow, kind: "receipt" | "photo", file: File) => {
    if (!row.id) return;
    try {
      await uploadAttachment.mutateAsync({
        entityType: LEDGER_ENTITY_TYPE,
        entityId: row.id,
        orgId,
        kind,
        file,
      });
      toast.success(`${kind === "receipt" ? "영수증" : "사진"}을 첨부했어요`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "첨부하지 못했습니다.");
    }
  };

  const openAttachments = (row: DraftLedgerRow, kind: "receipt" | "photo") => {
    const selected = (row.id ? attachmentsByRow.get(row.id) ?? [] : []).filter((item) => item.kind === kind);
    if (selected.length === 0) return;
    setViewer({
      title: `${selectedBuilding?.name ?? "건물"} · ${row.entryDate} · ${kind === "receipt" ? "영수증" : "공사사진"}`,
      attachments: selected,
    });
  };

  const changeStartMonth = (next: string) => {
    setStartMonth(next);
    if (next > endMonth) setEndMonth(next);
  };

  const changeEndMonth = (next: string) => {
    setEndMonth(next);
    if (next < startMonth) setStartMonth(next);
  };

  const printableRows: LongTermRepairPrintRow[] = displayRows.map((row) => ({
    key: row.clientKey,
    entryDate: row.entryDate,
    entryNo: row.entryNo,
    fundNote: row.fundNote,
    deposit: row.deposit,
    withdrawal: row.withdrawal,
    balance: row.balance,
  }));

  return (
    <>
      <div className="flex min-h-[calc(100vh-62px)] flex-col p-4 print:hidden sm:p-6">
        <header className="mb-5">
          <p className="text-xs font-semibold text-t3">관리업무 · 적립금 원장</p>
          <h1 className="mt-1 text-2xl font-extrabold text-t1">장기수선비 관리</h1>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-sm font-extrabold text-t1">적립 건물 목록</h2>
              <p className="mt-1 text-xs text-t3">코드·명칭</p>
            </div>
            <div className="grid grid-cols-[88px_1fr] border-b border-line bg-bg px-3 py-2 text-[11px] font-bold text-t3">
              <span>코드</span><span>명칭</span>
            </div>
            <div className="max-h-[calc(100vh-235px)] overflow-y-auto p-2">
              {buildings.length === 0 ? (
                <p className="p-6 text-center text-sm text-t4">등록된 건물이 없습니다.</p>
              ) : buildings.map((building) => (
                <button
                  key={building.id}
                  type="button"
                  className={`grid w-full grid-cols-[88px_1fr] rounded-xl px-2 py-3 text-left text-sm transition-colors ${building.id === buildingId ? "bg-blue-t text-blue-d" : "text-t2 hover:bg-bg"}`}
                  aria-pressed={building.id === buildingId}
                  onClick={() => {
                    if (editing && dirty && !window.confirm("저장하지 않은 변경을 취소하고 건물을 바꿀까요?")) return;
                    setBuildingId(building.id);
                    setEditing(false);
                    setDirty(false);
                    setDraftRows([]);
                    setDeletedIds([]);
                  }}
                >
                  <span className="truncate font-bold">{building.code}</span>
                  <span className="truncate font-semibold">{building.name}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-w-0 flex-col overflow-visible rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
              <div className="mr-auto min-w-40">
                <h2 className="text-sm font-extrabold text-t1">적립금 내역</h2>
                <p className="mt-0.5 truncate text-xs text-t3">{selectedBuilding ? `${selectedBuilding.code} · ${selectedBuilding.name}` : "건물 미선택"}</p>
              </div>
              <span className="text-xs font-bold text-t3">조회기간</span>
              <CustomDropdown
                ariaLabel="조회 시작 연도"
                value={startMonth.slice(0, 4)}
                options={yearOptions}
                disabled={editing}
                onChange={(year) => changeStartMonth(`${year}-${startMonth.slice(5, 7)}`)}
              />
              <CustomDropdown
                ariaLabel="조회 시작 월"
                value={startMonth.slice(5, 7)}
                options={MONTH_OPTIONS}
                disabled={editing}
                onChange={(month) => changeStartMonth(`${startMonth.slice(0, 4)}-${month}`)}
              />
              <span className="font-bold text-t4">~</span>
              <CustomDropdown
                ariaLabel="조회 종료 연도"
                value={endMonth.slice(0, 4)}
                options={yearOptions}
                disabled={editing}
                onChange={(year) => changeEndMonth(`${year}-${endMonth.slice(5, 7)}`)}
              />
              <CustomDropdown
                ariaLabel="조회 종료 월"
                value={endMonth.slice(5, 7)}
                options={MONTH_OPTIONS}
                disabled={editing}
                onChange={(month) => changeEndMonth(`${endMonth.slice(0, 4)}-${month}`)}
              />
              <Button type="button" variant="ghost" className="h-9 px-3" onClick={print}>출력</Button>
              <Button type="button" variant="ghost" className="h-9 px-3" onClick={addRow} disabled={ledgerQuery.isFetching}>추가</Button>
              {!editing ? (
                <Button type="button" variant="ghost" className="h-9 px-3" onClick={enterEdit} disabled={!buildingId || ledgerQuery.isFetching}>수정</Button>
              ) : (
                <>
                  <Button type="button" variant="ghost" className="h-9 border-red-t px-3 text-red" onClick={cancelEdit}>취소</Button>
                  <Button type="button" className="h-9 px-4" onClick={() => void persist()} disabled={!dirty || saveLedger.isPending}>
                    {saveLedger.isPending ? "저장 중…" : "저장"}
                  </Button>
                </>
              )}
            </div>

            {!buildingId ? (
              <div className="flex min-h-80 flex-1 items-center justify-center p-8 text-sm text-t4">좌측에서 건물을 선택해 주세요</div>
            ) : ledgerQuery.isLoading || openingBalanceQuery.isLoading ? (
              <div className="flex min-h-80 flex-1 items-center justify-center"><Spinner /></div>
            ) : ledgerQuery.isError || openingBalanceQuery.isError ? (
              <div className="flex min-h-80 flex-1 items-center justify-center p-8 text-sm font-bold text-red">적립금 내역을 불러오지 못했습니다.</div>
            ) : (
              <>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full min-w-[1280px] table-fixed border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-bg text-t3">
                      <tr>
                        <th className="w-[118px] border-b border-r border-line p-2">일자</th>
                        <th className="w-[82px] border-b border-r border-line p-2">번호</th>
                        <th className="w-[190px] border-b border-r border-line p-2">적립금 적요</th>
                        <th className="w-[125px] border-b border-r border-line p-2 text-right">적립금입금</th>
                        <th className="w-[125px] border-b border-r border-line p-2 text-right">적립금출금</th>
                        <th className="w-[125px] border-b border-r border-line p-2 text-right">차인잔액</th>
                        <th className="w-[170px] border-b border-r border-line p-2">적요</th>
                        <th className="w-[105px] border-b border-r border-line p-2">영수증</th>
                        <th className="w-[105px] border-b border-line p-2">사진</th>
                        {editing && <th className="w-[58px] border-b border-l border-line p-2">삭제</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.length === 0 ? (
                        <tr><td colSpan={editing ? 10 : 9} className="h-64 text-center text-sm text-t4">조회기간에 등록된 내역이 없습니다. 추가 버튼으로 입력해 주세요.</td></tr>
                      ) : displayRows.map((row) => {
                        const rowAttachments = row.id ? attachmentsByRow.get(row.id) ?? [] : [];
                        const receipts = rowAttachments.filter((attachment) => attachment.kind === "receipt");
                        const photos = rowAttachments.filter((attachment) => attachment.kind === "photo");
                        const inputClass = "h-8 w-full rounded-lg border border-line bg-white px-2 text-xs text-t1 outline-none focus:border-blue";
                        return (
                          <tr key={row.clientKey} className="border-b border-line2 hover:bg-blue-t2/40">
                            <td className="border-r border-line2 p-1.5 text-center">
                              {editing ? <input aria-label="일자" type="date" className={inputClass} value={row.entryDate} onChange={(event) => updateRow(row.clientKey, { entryDate: event.target.value })} /> : row.entryDate}
                            </td>
                            <td className="border-r border-line2 p-1.5 text-center">
                              {editing ? <input aria-label="번호" className={`${inputClass} text-center`} value={row.entryNo} onChange={(event) => updateRow(row.clientKey, { entryNo: event.target.value })} /> : row.entryNo || "-"}
                            </td>
                            <td className="border-r border-line2 p-1.5">
                              {editing ? <input aria-label="적립금 적요" className={inputClass} value={row.fundNote} onChange={(event) => updateRow(row.clientKey, { fundNote: event.target.value })} /> : row.fundNote}
                            </td>
                            <td className="border-r border-line2 p-1.5 text-right tabular-nums">
                              {editing ? <input aria-label="적립금입금" inputMode="numeric" className={`${inputClass} text-right tabular-nums`} value={row.deposit ? formatMoney(row.deposit) : ""} onChange={(event) => updateRow(row.clientKey, { deposit: parseAmount(event.target.value) })} /> : row.deposit ? formatMoney(row.deposit) : "-"}
                            </td>
                            <td className="border-r border-line2 p-1.5 text-right tabular-nums">
                              {editing ? <input aria-label="적립금출금" inputMode="numeric" className={`${inputClass} text-right tabular-nums`} value={row.withdrawal ? formatMoney(row.withdrawal) : ""} onChange={(event) => updateRow(row.clientKey, { withdrawal: parseAmount(event.target.value) })} /> : row.withdrawal ? formatMoney(row.withdrawal) : "-"}
                            </td>
                            <td className={`border-r border-line2 p-2 text-right font-bold tabular-nums ${row.balance < 0 ? "text-red" : "text-t1"}`}>{formatMoney(row.balance)}</td>
                            <td className="border-r border-line2 p-1.5">
                              {editing ? <input aria-label="적요" className={inputClass} value={row.memo} onChange={(event) => updateRow(row.clientKey, { memo: event.target.value })} /> : row.memo || "-"}
                            </td>
                            <td className="border-r border-line2 p-1.5">
                              <AttachmentCell label="영수증" kind="receipt" row={row} attachments={receipts} editing={editing} uploading={uploadAttachment.isPending} onOpen={() => openAttachments(row, "receipt")} onUpload={(file) => upload(row, "receipt", file)} />
                            </td>
                            <td className="p-1.5">
                              <AttachmentCell label="사진" kind="photo" row={row} attachments={photos} editing={editing} uploading={uploadAttachment.isPending} onOpen={() => openAttachments(row, "photo")} onUpload={(file) => upload(row, "photo", file)} />
                            </td>
                            {editing && (
                              <td className="border-l border-line2 p-1.5 text-center">
                                <button type="button" aria-label={`${row.entryDate} ${row.entryNo} 행 삭제`} className="rounded-md px-2 py-1 text-sm font-bold text-red hover:bg-red-t" onClick={() => removeRow(row)}>×</button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-3 border-t border-line bg-bg/70 p-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-line bg-surface px-4 py-3">
                    <p className="text-xs font-bold text-t3">적립금입금 합계</p>
                    <p className="mt-1 text-right text-lg font-extrabold tabular-nums text-t1">{formatMoney(depositTotal)}원</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface px-4 py-3">
                    <p className="text-xs font-bold text-t3">적립금출금 합계</p>
                    <p className="mt-1 text-right text-lg font-extrabold tabular-nums text-t1">{formatMoney(withdrawalTotal)}원</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface px-4 py-3">
                    <p className="text-xs font-bold text-t3">현잔액</p>
                    <p className={`mt-1 text-right text-lg font-extrabold tabular-nums ${currentBalance < 0 ? "text-red" : "text-blue-d"}`}>{formatMoney(currentBalance)}원</p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {selectedBuilding && printableRows.length > 0 && !viewer && (
        <LongTermRepairPrintView
          buildingName={selectedBuilding.name}
          companyName={companyName}
          startMonth={startMonth}
          endMonth={endMonth}
          rows={printableRows}
        />
      )}

      {viewer && (
        <AttachmentViewer
          title={viewer.title}
          attachments={viewer.attachments}
          canDelete={editing}
          onClose={() => setViewer(null)}
          onDelete={async (attachment) => {
            try {
              await deleteAttachment.mutateAsync({ id: attachment.id, path: attachment.fileUrl });
              setViewer((current) => current ? {
                ...current,
                attachments: current.attachments.filter((item) => item.id !== attachment.id),
              } : null);
              toast.success("첨부파일을 삭제했어요");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "첨부파일을 삭제하지 못했습니다.");
            }
          }}
        />
      )}
    </>
  );
}
