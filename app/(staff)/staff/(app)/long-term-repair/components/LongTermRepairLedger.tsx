"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Input, Spinner } from "@/components/common";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { DpDatePicker } from "@/components/common/DpDatePicker";
import {
  useLongTermRepairLedger,
  useLongTermRepairOpeningBalance,
  useSaveLongTermRepairLedger,
  type LongTermRepairLedgerEntry,
} from "@/hooks/reactquery/longTermRepair";
import {
  useAttachmentsByEntities,
  useDeleteAttachment,
  useUploadAttachments,
  type Attachment,
} from "@/hooks/reactquery/attachments";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig } from "@/hooks/reactquery/setupConfig";
import { formatNumber } from "@/lib/format";
import { AttachmentViewer } from "./AttachmentViewer";
import { CustomDropdown } from "./CustomDropdown";
import {
  LongTermRepairPrintView,
  type LongTermRepairPrintRow,
} from "./LongTermRepairPrintView";
import { longTermRepairClasses as styles } from "./longTermRepairClasses";

const LEDGER_ENTITY_TYPE = "long_term_repair_ledger";
type AttachmentKind = "receipt" | "photo";
const ATTACHMENT_KINDS: AttachmentKind[] = ["receipt", "photo"];
const EMPTY_FILES: File[] = [];

function stagedAttachmentKey(clientKey: string, kind: AttachmentKind) {
  return `${clientKey}:${kind}`;
}

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
  row: DraftLedgerRow;
  kind: AttachmentKind;
}

interface LongTermRepairLedgerProps {
  orgId: number;
  buildings: Array<{ id: number; code: string; name: string }>;
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

// 서버 list_long_term_repair_ledger와 같은 규칙: 번호의 숫자부 우선(숫자 없으면 뒤), 그다음 원문, id.
function entryNoNumber(entryNo: string) {
  const digits = entryNo.replace(/\D/g, "");
  return digits ? Number(digits) : Number.POSITIVE_INFINITY;
}

function compareRows(a: DraftLedgerRow, b: DraftLedgerRow) {
  const numA = entryNoNumber(a.entryNo);
  const numB = entryNoNumber(b.entryNo);
  return a.entryDate.localeCompare(b.entryDate)
    || (numA === numB ? 0 : numA < numB ? -1 : 1)
    || (a.entryNo < b.entryNo ? -1 : a.entryNo > b.entryNo ? 1 : 0)
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
  return formatNumber(value);
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
  attachments,
  stagedFiles = EMPTY_FILES,
  editing,
  onOpen,
}: {
  label: string;
  attachments: Attachment[];
  stagedFiles?: readonly File[];
  editing: boolean;
  onOpen: () => void;
}) {
  const attachmentCount = attachments.length + stagedFiles.length;
  const buttonTone = attachmentCount
    ? editing ? styles.attachmentButtonActive : styles.attachmentButtonActiveReadOnly
    : editing ? styles.attachmentButtonIdleEditing : styles.attachmentButtonIdle;
  return (
    <button
      type="button"
      className={`${styles.attachmentButton} ${buttonTone}`}
      onClick={onOpen}
      aria-label={`${label} ${attachmentCount}장 열기`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7" />
      </svg>
      <b className={`${styles.attachmentCount} ${attachmentCount ? "" : styles.attachmentCountEmpty}`}>
        {attachmentCount}
      </b>
    </button>
  );
}

export function LongTermRepairLedger({ orgId, buildings }: LongTermRepairLedgerProps) {
  const confirm = useConfirm();
  const now = new Date();
  const currentYear = now.getFullYear();
  // 조회 종료월 기본값은 이번 달. 마감월(전월)까지로 두면 이번 달에 입력한 내역이 목록에서 빠진다.
  const currentMonthNumber = now.getMonth() + 1;
  const initialEndMonth = `${currentYear}-${String(currentMonthNumber).padStart(2, "0")}`;
  const openingDecemberYear = currentMonthNumber === 12 ? currentYear : currentYear - 1;
  const [startMonth, setStartMonth] = useState(`${openingDecemberYear}-12`);
  const [endMonth, setEndMonth] = useState(initialEndMonth);
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draftRows, setDraftRows] = useState<DraftLedgerRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<number[]>([]);
  const [stagedFilesByKey, setStagedFilesByKey] = useState<Record<string, File[]>>({});
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [persisting, setPersisting] = useState(false);
  const tempKey = useRef(0);

  const ledgerQuery = useLongTermRepairLedger(buildingId, startMonth, endMonth);
  const openingBalanceQuery = useLongTermRepairOpeningBalance(buildingId, startMonth);
  const isLedgerInitialLoading = ledgerQuery.isLoading || openingBalanceQuery.isLoading;
  const isLedgerRefreshing =
    (ledgerQuery.isFetching && !ledgerQuery.isLoading) ||
    (openingBalanceQuery.isFetching && !openingBalanceQuery.isLoading);
  const isLedgerBusy = isLedgerInitialLoading || isLedgerRefreshing;
  const saveLedger = useSaveLongTermRepairLedger();
  const uploadAttachments = useUploadAttachments();
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
  const { data: setupConfig } = useSetupConfig(orgId);
  const { data: me } = useMe();
  const companyName = setupConfig?.companyName?.trim() || me?.orgName?.trim() || "";

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
  const viewerIsStaging = viewer?.row.id === undefined;
  const viewerAttachments = viewer?.row.id
    ? (attachmentsByRow.get(viewer.row.id) ?? []).filter((item) => item.kind === viewer.kind)
    : [];
  const viewerStagedFiles = viewerIsStaging && viewer
    ? stagedFilesByKey[stagedAttachmentKey(viewer.row.clientKey, viewer.kind)] ?? EMPTY_FILES
    : EMPTY_FILES;

  const clearStagedFiles = () => setStagedFilesByKey({});

  const clearRowStagedFiles = (clientKey: string) => {
    setStagedFilesByKey((current) => {
      const next = { ...current };
      for (const kind of ATTACHMENT_KINDS) delete next[stagedAttachmentKey(clientKey, kind)];
      return next;
    });
  };

  const stageFiles = (clientKey: string, kind: AttachmentKind, files: File[]) => {
    setStagedFilesByKey((current) => {
      const key = stagedAttachmentKey(clientKey, kind);
      return { ...current, [key]: [...(current[key] ?? EMPTY_FILES), ...files] };
    });
    setDirty(true);
  };

  const removeStagedFile = (clientKey: string, kind: AttachmentKind, file: File) => {
    setStagedFilesByKey((current) => {
      const key = stagedAttachmentKey(clientKey, kind);
      const files = current[key] ?? EMPTY_FILES;
      const fileIndex = files.indexOf(file);
      if (fileIndex < 0) return current;
      const nextFiles = files.filter((_, index) => index !== fileIndex);
      if (nextFiles.length === 0) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: nextFiles };
    });
    setDirty(true);
  };

  const enterEdit = () => {
    if (!buildingId) return;
    setDraftRows(serverRows.map(toDraft));
    setDeletedIds([]);
    clearStagedFiles();
    setViewer(null);
    setDirty(false);
    setAdding(false);
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
    setAdding(true);
    setDirty(true);
  };

  const cancelEdit = () => {
    setViewer(null);
    setEditing(false);
    setAdding(false);
    setDirty(false);
    setDraftRows([]);
    setDeletedIds([]);
    clearStagedFiles();
    toast.success("변경을 취소했어요");
  };

  const updateRow = (clientKey: string, patch: Partial<DraftLedgerRow>) => {
    setDraftRows((current) => current.map((row) => row.clientKey === clientKey ? { ...row, ...patch } : row));
    setDirty(true);
  };

  const removeRow = async (row: DraftLedgerRow) => {
    const ok = await confirm({ title: "행 삭제", description: "행을 삭제할까요?", confirmLabel: "삭제", variant: "danger" });
    if (!ok) return;
    setDraftRows((current) => current.filter((candidate) => candidate.clientKey !== row.clientKey));
    clearRowStagedFiles(row.clientKey);
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
    setPersisting(true);
    try {
      const rowsToSave = draftRows;
      const savedIds = await saveLedger.mutateAsync({
        buildingId,
        rows: rowsToSave.map((row) => ({
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

      // RPC는 p_rows와 같은 길이·순서로 id를 돌려준다. 길이가 어긋나면 인덱스 매핑을 믿을 수 없으므로
      // 엉뚱한 행에 첨부가 붙는 대신 업로드를 건너뛰고 실패로 알린다.
      const idsAligned = savedIds.length === rowsToSave.length;
      const stagedUploadTasks = rowsToSave.flatMap((row, index) => {
        if (row.id !== undefined) return [];
        const entityId = idsAligned ? savedIds[index] : undefined;
        return ATTACHMENT_KINDS.flatMap((kind) => {
          const files = stagedFilesByKey[stagedAttachmentKey(row.clientKey, kind)] ?? EMPTY_FILES;
          if (files.length === 0) return [];
          return [{ entityId, kind, files }];
        });
      });
      let failedUploadCount = 0;
      const uploadResults = await Promise.allSettled(
        stagedUploadTasks.map(({ entityId, kind, files }) => {
          if (entityId === undefined || !Number.isSafeInteger(entityId)) {
            failedUploadCount += files.length;
            return Promise.resolve(null);
          }
          return uploadAttachments.mutateAsync({
            entityType: LEDGER_ENTITY_TYPE,
            entityId,
            orgId,
            kind,
            fileType: "image",
            files,
          });
        }),
      );
      uploadResults.forEach((result, index) => {
        if (result.status === "rejected") failedUploadCount += stagedUploadTasks[index]?.files.length ?? 0;
        else if (result.value) failedUploadCount += result.value.failed.length;
      });
      // 조회 범위(기본: 마감월까지)를 벗어난 일자로 저장하면 재조회 때 필터링돼 방금 넣은 행이 사라진다.
      // 저장한 일자를 포함하도록 범위를 넓혀, 입력한 내역이 항상 목록에 남게 한다.
      const savedMonths = rowsToSave.map((row) => row.entryDate.slice(0, 7));
      const earliest = savedMonths.reduce((min, month) => (month < min ? month : min), startMonth);
      const latest = savedMonths.reduce((max, month) => (month > max ? month : max), endMonth);
      if (earliest < startMonth) setStartMonth(earliest);
      if (latest > endMonth) setEndMonth(latest);
      setEditing(false);
      setAdding(false);
      setDirty(false);
      setDraftRows([]);
      setDeletedIds([]);
      setViewer(null);
      clearStagedFiles();
      if (failedUploadCount > 0) {
        // 행 자체는 저장됐으므로 이제 id가 있다. 해당 행의 첨부 버튼으로 다시 올리면 된다.
        toast.warning(`적립금 내역은 저장했지만 첨부파일 ${failedUploadCount}개를 업로드하지 못했습니다. 해당 행의 첨부 버튼에서 다시 올려 주세요.`);
      } else {
        toast.success("적립금 내역을 저장했어요");
      }
    } catch (error) {
      toast.error(error, "적립금 내역을 저장하지 못했습니다.");
    } finally {
      setPersisting(false);
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

  const openAttachments = (row: DraftLedgerRow, kind: AttachmentKind) => {
    setViewer({ row, kind });
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
      <div className={`${styles.screen} print:hidden`} data-testid="long-term-repair-screen">
        <div className={styles.workspace} data-testid="long-term-repair-workspace">
          <aside className={`${styles.panel} ${styles.buildingPanel}`} data-testid="long-term-repair-buildings">
            <div className={`${styles.panelHeader} ${styles.buildingHeader}`}>
              <h2 className={styles.panelTitle}>적립 건물</h2>
            </div>
            <div className={styles.buildingTableHeader} aria-hidden="true">
              <span>코드</span>
              <span>명칭</span>
            </div>
            <div className={styles.buildingScroll}>
              {buildings.length === 0 ? (
                <p className={styles.buildingEmpty}>등록된 건물이 없습니다.</p>
              ) : buildings.map((building) => (
                <button
                  key={building.id}
                  type="button"
                  className={`${styles.buildingRow} ${building.id === buildingId ? styles.buildingRowSelected : styles.buildingRowDefault}`}
                  aria-pressed={building.id === buildingId}
                  disabled={persisting}
                  onClick={async () => {
                    if (persisting) return;
                    if (editing && dirty) {
                      const ok = await confirm({
                        title: "저장하지 않고 건물 변경",
                        description: "저장하지 않은 변경을 취소하고 건물을 바꿀까요?",
                        confirmLabel: "건물 변경",
                      });
                      if (!ok) return;
                    }
                    setBuildingId(building.id);
                    setEditing(false);
                    setAdding(false);
                    setDirty(false);
                    setDraftRows([]);
                    setDeletedIds([]);
                    setViewer(null);
                    clearStagedFiles();
                  }}
                >
                  <span className={styles.buildingCode}>{building.code}</span>
                  <span className={styles.buildingName} title={building.name}>{building.name}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className={`${styles.panel} ${styles.ledgerPanel}`} data-testid="long-term-repair-ledger">
            <div className={`${styles.panelHeader} ${styles.toolbar}`}>
              <h2 className={styles.panelTitle}>
                {selectedBuilding ? `${selectedBuilding.name} 적립금 내역` : "적립금 내역"}
              </h2>
              <div className={styles.toolbarSpacer} />
              <span className={styles.toolbarLabel}>조회일</span>
              <CustomDropdown
                menuTransition
                ariaLabel="조회 시작 연도"
                value={startMonth.slice(0, 4)}
                options={yearOptions}
                compact
                disabled={editing}
                onChange={(year) => changeStartMonth(`${year}-${startMonth.slice(5, 7)}`)}
              />
              <CustomDropdown
                menuTransition
                ariaLabel="조회 시작 월"
                value={startMonth.slice(5, 7)}
                options={MONTH_OPTIONS}
                compact
                disabled={editing}
                onChange={(month) => changeStartMonth(`${startMonth.slice(0, 4)}-${month}`)}
              />
              <span className={styles.rangeSeparator}>~</span>
              <CustomDropdown
                menuTransition
                ariaLabel="조회 종료 연도"
                value={endMonth.slice(0, 4)}
                options={yearOptions}
                compact
                disabled={editing}
                onChange={(year) => changeEndMonth(`${year}-${endMonth.slice(5, 7)}`)}
              />
              <CustomDropdown
                menuTransition
                ariaLabel="조회 종료 월"
                value={endMonth.slice(5, 7)}
                options={MONTH_OPTIONS}
                compact
                disabled={editing}
                onChange={(month) => changeEndMonth(`${endMonth.slice(0, 4)}-${month}`)}
              />
              <button type="button" className={`${styles.miniButton} ${styles.neutralButton}`} onClick={print}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 8V4h10v4" />
                  <rect x="4" y="8" width="16" height="8" rx="2" />
                  <path d="M7 16h10v4H7z" />
                </svg>
                출력
              </button>
              {isLedgerRefreshing ? (
                <span role="status" aria-label="적립금 내역 갱신 중" className={`${styles.miniButton} ${styles.neutralButton}`}>갱신 중…</span>
              ) : null}
              {(!editing || adding) && (
                <button type="button" className={`${styles.miniButton} ${styles.neutralButton}`} onClick={addRow} disabled={isLedgerBusy || persisting}>추가</button>
              )}
              {(!editing || !adding) && (
                <button type="button" className={`${styles.miniButton} ${styles.neutralButton}`} onClick={enterEdit} disabled={persisting}>수정</button>
              )}
              {editing && (
                <>
                  {/* 저장 중 취소를 허용하면 UI만 취소되고 저장·첨부 업로드는 계속 진행돼 상태가 어긋난다. */}
                  <button type="button" className={`${styles.miniButton} ${styles.cancelButton}`} onClick={cancelEdit} disabled={persisting}>취소</button>
                  <button type="button" className={`${styles.miniButton} ${styles.saveButton}`} onClick={() => void persist()} disabled={!dirty || saveLedger.isPending || persisting}>
                    저장
                  </button>
                </>
              )}
            </div>

            <div className={styles.ledgerBody}>
              {!buildingId ? (
              <div className={styles.emptyState}>좌측에서 건물을 선택해 주세요</div>
            ) : isLedgerInitialLoading ? (
              <div className={styles.emptyState}><Spinner label="적립금 내역 불러오는 중" /></div>
            ) : ledgerQuery.isError || openingBalanceQuery.isError ? (
              <div role="alert" className={`${styles.emptyState} ${styles.negative}`}>적립금 내역을 불러오지 못했습니다.</div>
            ) : (
              <>
                <div className={styles.tableScroll}>
                  <table className={`${styles.ledgerTable} ${editing ? styles.ledgerTableEditing : ""}`}>
                    <thead>
                      <tr>
                        <th className="w-[96px]">일자</th>
                        <th className="w-[76px]">번호</th>
                        <th>적립금 적요</th>
                        <th className={`${styles.right} w-[104px]`}>적립금입금</th>
                        <th className={`${styles.right} w-[104px]`}>적립금출금</th>
                        <th className={`${styles.right} w-[112px]`}>차인잔액</th>
                        <th className="w-[96px]">적요</th>
                        <th className="w-[72px]">영수증</th>
                        <th className="w-[72px]">사진</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.length === 0 ? (
                        <tr className={styles.ledgerRow}><td colSpan={9} className="text-center !text-t4">조회기간에 등록된 내역이 없습니다.</td></tr>
                      ) : displayRows.map((row, index) => {
                        const rowAttachments = row.id ? attachmentsByRow.get(row.id) ?? [] : [];
                        const receipts = rowAttachments.filter((attachment) => attachment.kind === "receipt");
                        const photos = rowAttachments.filter((attachment) => attachment.kind === "photo");
                        const stagedReceipts = row.id === undefined
                          ? stagedFilesByKey[stagedAttachmentKey(row.clientKey, "receipt")] ?? EMPTY_FILES
                          : EMPTY_FILES;
                        const stagedPhotos = row.id === undefined
                          ? stagedFilesByKey[stagedAttachmentKey(row.clientKey, "photo")] ?? EMPTY_FILES
                          : EMPTY_FILES;
                        const canEditRow = editing && (!adding || !row.id);
                        const monthKey = row.entryDate.slice(0, 7);
                        const nextMonthKey = displayRows[index + 1]?.entryDate.slice(0, 7);
                        const isMonthEnd = monthKey !== nextMonthKey;
                        const monthRows = isMonthEnd
                          ? displayRows.filter((candidate) => candidate.entryDate.startsWith(monthKey))
                          : [];
                        const monthDeposit = monthRows.reduce((sum, candidate) => sum + candidate.deposit, 0);
                        const monthWithdrawal = monthRows.reduce((sum, candidate) => sum + candidate.withdrawal, 0);
                        return (
                          <Fragment key={row.clientKey}>
                            <tr className={`${styles.ledgerRow} ${styles.ledgerRowHover} ${!row.id ? styles.newRow : ""}`}>
                              <td>
                                {canEditRow ? (
                                  <DpDatePicker
                                    ariaLabel="일자"
                                    value={row.entryDate}
                                    onChange={(entryDate) => updateRow(row.clientKey, { entryDate })}
                                    triggerClassName={`${styles.dateControl} ${styles.editableDate}`}
                                    triggerOpenClassName={styles.dateControlOpen}
                                    endAdornment={(
                                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <rect x="4" y="5" width="16" height="16" rx="2" />
                                        <path d="M8 3v4M16 3v4M4 11h16" />
                                      </svg>
                                    )}
                                  />
                                ) : (
                                  <div className={`${styles.dateControl} ${styles.dateControlReadOnly}`}>
                                    <span>{row.entryDate.replaceAll("-", ".")}</span>
                                  </div>
                                )}
                              </td>
                              <td className={styles.numberCell}>{row.entryNo || "-"}</td>
                              <td>
                                {canEditRow ? (
                                  <Input unstyled aria-label="적립금 적요" className={`${styles.ledgerInput} ${styles.editableInput}`} value={row.fundNote} placeholder="적립금 적요" onChange={(event) => updateRow(row.clientKey, { fundNote: event.target.value })} />
                                ) : (
                                  <span className={styles.plainCell}>{row.fundNote}</span>
                                )}
                              </td>
                              <td>
                                {canEditRow ? (
                                  <Input unstyled aria-label="적립금입금" inputMode="numeric" className={`${styles.ledgerInput} ${styles.moneyInput} ${styles.editableInput}`} value={row.deposit ? formatMoney(row.deposit) : ""} placeholder="0" onChange={(event) => updateRow(row.clientKey, { deposit: parseAmount(event.target.value) })} />
                                ) : (
                                  <span className={`${styles.plainCell} ${styles.moneyInput}`}>{formatMoney(row.deposit)}</span>
                                )}
                              </td>
                              <td>
                                {canEditRow ? (
                                  <Input unstyled aria-label="적립금출금" inputMode="numeric" className={`${styles.ledgerInput} ${styles.moneyInput} ${styles.editableInput}`} value={row.withdrawal ? formatMoney(row.withdrawal) : ""} placeholder="0" onChange={(event) => updateRow(row.clientKey, { withdrawal: parseAmount(event.target.value) })} />
                                ) : (
                                  <span className={`${styles.plainCell} ${styles.moneyInput}`}>{formatMoney(row.withdrawal)}</span>
                                )}
                              </td>
                              <td className={`${styles.balanceCell} ${row.balance < 0 ? styles.negative : ""}`}>{formatMoney(row.balance)}</td>
                              <td>
                                <div className={styles.noteCell}>
                                  {canEditRow ? (
                                    <>
                                      <Input unstyled aria-label="적요" className={`${styles.ledgerInput} ${styles.editableInput}`} value={row.memo} placeholder="적요" onChange={(event) => updateRow(row.clientKey, { memo: event.target.value })} />
                                      <button type="button" aria-label={`${row.entryDate} ${row.entryNo} 행 삭제`} className={styles.deleteButton} onClick={() => removeRow(row)}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                                          <path d="M6 6l12 12M18 6 6 18" />
                                        </svg>
                                      </button>
                                    </>
                                  ) : (
                                    <span className={styles.plainCell}>{row.memo}</span>
                                  )}
                                </div>
                              </td>
                              <td className={styles.attachmentCell}>
                                <AttachmentCell label="영수증" attachments={receipts} stagedFiles={stagedReceipts} editing={editing} onOpen={() => openAttachments(row, "receipt")} />
                              </td>
                              <td className={styles.attachmentCell}>
                                <AttachmentCell label="사진" attachments={photos} stagedFiles={stagedPhotos} editing={editing} onOpen={() => openAttachments(row, "photo")} />
                              </td>
                            </tr>
                            {isMonthEnd && (
                              <tr className={styles.subtotalRow}>
                                <td />
                                <td />
                                <td className={styles.right}>{monthKey.replace("-", ".")}</td>
                                <td className={styles.right}>{formatMoney(monthDeposit)}</td>
                                <td className={styles.right}>{formatMoney(monthWithdrawal)}</td>
                                <td className={styles.right}>월잔액 {formatMoney(row.balance)}</td>
                                <td />
                                <td />
                                <td />
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className={styles.footer}>
                  <span className="sr-only">적립금입금 합계</span>
                  <span className={styles.footerItem}>
                    <i className={styles.footerLabel}>적립금입금</i>
                    <b className={`${styles.footerValue} ${styles.footerValueDefault}`}>{formatMoney(depositTotal)}</b>
                  </span>
                  <span className="sr-only">적립금출금 합계</span>
                  <span className={styles.footerItem}>
                    <i className={styles.footerLabel}>적립금출금</i>
                    <b className={`${styles.footerValue} ${styles.footerValueDefault}`}>{formatMoney(withdrawalTotal)}</b>
                  </span>
                  <span className={styles.footerItem}>
                    <i className={styles.footerLabel}>현잔액</i>
                    <b className={`${styles.footerValue} ${styles.footerValueTotal} ${currentBalance < 0 ? styles.negative : styles.footerTotalTone}`}>{formatMoney(currentBalance)}</b>
                  </span>
                </div>
              </>
            )}
            </div>
          </section>
        </div>
      </div>

      {selectedBuilding && printableRows.length > 0 && !viewer && (
        <LongTermRepairPrintView
          buildingName={selectedBuilding.name}
          startMonth={startMonth}
          endMonth={endMonth}
          rows={printableRows}
          currentBalance={currentBalance}
          companyName={companyName}
        />
      )}

      {/* 첨부는 수정·추가 상태에서만 올리고 지운다(정본 .lt-at-modal.ro — 조회 상태는 보기 전용).
          저장된 행은 즉시 업로드하고, 새 행은 원장 저장 전까지 파일을 로컬에 보관한다. */}
      {viewer && (
        <AttachmentViewer
          title={viewer.kind === "receipt" ? "영수증" : "공사사진"}
          description={`${viewer.row.fundNote || "적립금 출금"} · ${viewer.row.entryDate.replaceAll("-", ".")} · 번호 ${viewer.row.entryNo || "-"}`}
          kindLabel={viewer.kind === "receipt" ? "영수증" : "공사사진"}
          attachments={viewerAttachments}
          stagedFiles={viewerStagedFiles}
          staging={viewerIsStaging}
          canEdit={editing}
          uploading={uploadAttachments.isPending}
          onClose={() => setViewer(null)}
          onUpload={async (files) => {
            const result = await uploadAttachments.mutateAsync({
              entityType: LEDGER_ENTITY_TYPE,
              entityId: viewer.row.id as number,
              orgId,
              kind: viewer.kind,
              fileType: "image",
              files,
            });
            if (result.succeeded.length > 0) setDirty(true);
            return result;
          }}
          onStageFiles={(files) => stageFiles(viewer.row.clientKey, viewer.kind, files)}
          onRemoveStagedFile={(file) => removeStagedFile(viewer.row.clientKey, viewer.kind, file)}
          onDelete={async (attachment) => {
            const kindLabel = viewer.kind === "receipt" ? "영수증" : "공사사진";
            const ok = await confirm({
              title: `${kindLabel} 삭제`,
              description: `이 ${kindLabel}을 삭제할까요? 바로 삭제되며 되돌릴 수 없어요.`,
              confirmLabel: "삭제",
              variant: "danger",
            });
            if (!ok) return;
            try {
              await deleteAttachment.mutateAsync({ id: attachment.id, path: attachment.fileUrl });
              setDirty(true);
              toast.success("첨부파일을 삭제했어요");
            } catch (error) {
              toast.error(error, "첨부파일을 삭제하지 못했습니다.");
            }
          }}
        />
      )}
    </>
  );
}
