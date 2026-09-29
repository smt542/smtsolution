"use client";

import { useMemo, useState } from "react";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { useAsyncAction } from "@/hooks/common";
import { appToast as toast } from "@/hooks/common/useAppToast";
import {
  useGiroPaymentsPeriods,
  useRecordGiroPayments,
} from "@/hooks/reactquery/payments";
import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import { useReceiptPaymentStatusPeriods } from "@/hooks/reactquery/receipts";
import {
  buildGiroPreview,
  type DepositPreviewUnit,
  type GiroPreviewRow,
} from "@/lib/payments/depositPreview";
import {
  displayGiroRoomNumber,
  GiroFileError,
  parseGiroFile,
  type GiroFile,
} from "@/lib/payments/giroFile";
import { formatWon } from "@/lib/format";
import { ComplaintDialog } from "../ComplaintDialog";
import { DepositUploadFooter } from "./DepositUploadFooter";
import { FileDropzone, FileDropzoneFileRow } from "./FileDropzone";
import { giroTableClass, giroTdClass, giroThClass, giroWrapClass } from "./giroClasses";

interface GiroUploadModalProps {
  open: boolean;
  orgId: number;
  onClose: () => void;
}

const GIRO_COLUMN_MIN_WIDTH_CLASSES = [
  "min-w-[49.41px]", "min-w-[105.2px]", "min-w-[110.03px]", "min-w-[67.02px]",
  "min-w-[56.89px]", "min-w-[112px]", "min-w-[56.89px]", "min-w-[65.17px]",
  "min-w-[48.59px]", "min-w-[76.89px]", "min-w-[78.67px]", "min-w-[63.13px]",
  "min-w-[105.2px]", "min-w-[52.75px]", "min-w-[63.13px]",
] as const;

function toPreviewUnits(rows: ReceiptPaymentRow[]): DepositPreviewUnit[] {
  return rows.map((row) => ({
    unitId: row.unitId,
    unitNo: row.unitNo,
    payerNo: row.payerNo,
    payerName: row.payerName,
    tenantName: row.tenantName,
    unpaid: row.unpaid,
    buildingName: row.buildingName,
    buildingCode: row.buildingCode,
    dong: row.dong,
    dueDate: row.dueDate,
  }));
}

function amountText(amount: number) {
  return amount.toLocaleString("ko-KR");
}

function dateDots(value: string | null) {
  return value ? value.replace(/-/g, ".") : "-";
}

function locationValues(row: GiroPreviewRow) {
  const { record, unit } = row;
  const period = record.period;
  if (!unit) {
    return {
      buildingCode: record.buildingCode,
      buildingName: "",
      unitNo: displayGiroRoomNumber(record.roomNo),
      year: period.slice(0, 4),
      month: period.slice(5, 7),
    };
  }
  const dong = unit.dong?.trim();
  return {
    buildingCode: record.buildingCode,
    buildingName: unit.buildingName ?? "",
    unitNo: dong ? `${dong} ${unit.unitNo}` : unit.unitNo,
    year: period.slice(0, 4),
    month: period.slice(5, 7),
  };
}

function GiroPreviewCell({
  value,
  className = "",
  done = false,
  children,
}: {
  value: string;
  className?: string;
  done?: boolean;
  children?: React.ReactNode;
}) {
  return (
    // 가로 스크롤 표(정본 auto + th min-width)라 칸이 내용만큼 늘어나야 한다 — 말줄임을 걸지 않는다.
    <td
      className={`${giroTdClass} ${done ? "!bg-blue-t2" : ""} ${className}`}
      title={value || undefined}
    >
      {children ?? value}
    </td>
  );
}

function GiroPreviewTable({
  rows,
  completed,
}: {
  rows: GiroPreviewRow[];
  completed: Set<number>;
}) {
  return (
    <div className={giroWrapClass}>
      <table className={giroTableClass}>
        <thead>
          <tr>
            {[
              "NO", "지로입금일", "수납일", "구분", "동", "빌라명", "호", "년", "월",
              "수납액", "에러체크", "수수료", "이중수납일", "연체", "연체료",
            ].map((header, index) => (
              <th
                key={header}
                className={`${giroThClass} ${GIRO_COLUMN_MIN_WIDTH_CLASSES[index]} ${index === 0 || [9, 11, 13, 14].includes(index) ? "text-right" : ""}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isDone = completed.has(row.record.rowIndex);
            const location = locationValues(row);
            const error = isDone ? "-" : row.error === "정상" ? "-" : row.error;
            const duplicateDate = !isDone && row.error === "이중수납" ? dateDots(row.duplicatePaidAt) : "-";
            return (
              <tr key={row.record.rowIndex}>
                <GiroPreviewCell value={String(index + 1)} done={isDone} className="num text-right" />
                <GiroPreviewCell value={dateDots(row.record.depositedAt)} done={isDone} />
                <GiroPreviewCell value={row.record.paidAt} done={isDone} />
                <GiroPreviewCell value={row.dueStatus} done={isDone}>
                  {row.dueStatus === "납기후" ? <span className="text-red">납기후</span> : row.dueStatus}
                </GiroPreviewCell>
                <GiroPreviewCell value={location.buildingCode} done={isDone} />
                <GiroPreviewCell value={location.buildingName} done={isDone} />
                <GiroPreviewCell value={location.unitNo} done={isDone} />
                <GiroPreviewCell value={location.year} done={isDone} className="num" />
                <GiroPreviewCell value={location.month} done={isDone} className="num" />
                <GiroPreviewCell value={amountText(row.record.amount)} done={isDone} className="num text-right" />
                <GiroPreviewCell value={error} done={isDone}>
                  {error === "-" ? error : <span className="text-red">{error}</span>}
                </GiroPreviewCell>
                <GiroPreviewCell value={amountText(row.record.fee)} done={isDone} className="num text-right" />
                <GiroPreviewCell value={duplicateDate} done={isDone} />
                <GiroPreviewCell value="-" done={isDone} className="text-right" />
                <GiroPreviewCell value="-" done={isDone} className="text-right" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function toPreviewRowsByPeriod(
  periods: Array<{ period: string; rows: ReceiptPaymentRow[] }>,
): Map<string, DepositPreviewUnit[]> {
  return new Map(periods.map(({ period, rows }) => [period, toPreviewUnits(rows)]));
}

export function GiroUploadModal({ open, orgId, onClose }: GiroUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [giroFile, setGiroFile] = useState<GiroFile | null>(null);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const parseFileAction = useAsyncAction();
  const confirm = useConfirm();
  const recordGiroPayments = useRecordGiroPayments();
  const periods = useMemo(
    () => [...new Set(giroFile?.records.map((record) => record.period) ?? [])].sort(),
    [giroFile],
  );
  const workspacePeriods = useReceiptPaymentStatusPeriods(orgId, periods, Boolean(giroFile));
  const giroPaymentPeriods = useGiroPaymentsPeriods(periods, Boolean(giroFile));
  const isPeriodDataLoading = Boolean(giroFile)
    && (workspacePeriods.isLoading || giroPaymentPeriods.isLoading);
  const unitsByPeriod = useMemo(
    () => toPreviewRowsByPeriod(workspacePeriods.periods),
    [workspacePeriods.periods],
  );
  const existingGiroPayments = useMemo(
    () => giroPaymentPeriods.periods.flatMap(({ period, data }) => data
      .filter((payment) => payment.status === "active")
      .map((payment) => ({
        unitId: payment.unitId,
        period,
        amount: payment.amount,
        paidAt: payment.paidAt,
      }))),
    [giroPaymentPeriods.periods],
  );
  const previewRows = useMemo(
    () => buildGiroPreview(giroFile?.records ?? [], unitsByPeriod, existingGiroPayments),
    [existingGiroPayments, giroFile, unitsByPeriod],
  );
  const processableRows = useMemo(
    () => previewRows.filter((row) => row.error === "정상" && !completed.has(row.record.rowIndex)),
    [completed, previewRows],
  );
  const total = useMemo(
    () => processableRows.reduce((sum, row) => sum + row.record.amount, 0),
    [processableRows],
  );
  const busy = parseFileAction.isPending || isPeriodDataLoading || isProcessing || recordGiroPayments.isPending;

  const resetFile = () => {
    if (busy) return;
    setFile(null);
    setGiroFile(null);
    setCompleted(new Set());
  };

  const parseFile = async (nextFile: File) => {
    setFile(nextFile);
    setGiroFile(null);
    setCompleted(new Set());
    await parseFileAction.run(async () => {
      try {
        setGiroFile(await parseGiroFile(nextFile));
      } catch (error) {
        toast.warning(error instanceof GiroFileError ? error.message : "파일을 읽지 못했어요");
        setFile(null);
        setGiroFile(null);
        setCompleted(new Set());
      }
    });
  };

  const handleClose = () => {
    if (!busy) onClose();
  };

  const processPayments = async () => {
    if (processableRows.length === 0 || busy) return;
    const accepted = await confirm({
      look: "check",
      title: "지로 수납을 반영하시겠습니까?",
      description: (
        <>
          처리 대상 <b>{processableRows.length}건</b> · 수납액 <b>{formatWon(total)}</b>
          <br />
          반영하면 해당 세대의 수납 이력에 기록됩니다.
        </>
      ),
      confirmLabel: "반영",
    });
    if (!accepted || busy) return;

    setIsProcessing(true);
    try {
      const result = await recordGiroPayments.mutateAsync(processableRows.map((row) => ({
        unitId: row.unit?.unitId ?? 0,
        period: row.record.period,
        amount: row.record.amount,
        fee: row.record.fee,
        paidAt: row.record.paidAt,
        externalRef: row.record.externalRef,
      })));
      const rowsByRef = new Map(processableRows.map((row) => [row.record.externalRef, row]));
      const doneRows = new Set(completed);
      for (const item of result.results) {
        if (item.status !== "recorded" && item.status !== "duplicate") continue;
        const row = (item.externalRef ? rowsByRef.get(item.externalRef) : undefined)
          ?? processableRows[item.index];
        if (row) doneRows.add(row.record.rowIndex);
      }
      setCompleted(doneRows);

      if (result.skipped > 0) {
        toast.error(`${result.skipped}건은 반영하지 못했어요`);
        return;
      }
      if (result.recorded === 0 && result.duplicate > 0) {
        toast.info(`${result.duplicate}건은 이미 반영돼 있었어요`);
      } else if (result.duplicate > 0) {
        toast.success(`${result.recorded}건을 수납 반영했어요 · ${result.duplicate}건은 이미 반영돼 있었어요`);
      } else {
        toast.success(`${result.recorded}건을 수납 반영했어요`);
      }
      onClose();
    } catch {
      toast.error("지로 수납을 반영하지 못했어요");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ComplaintDialog
      open={open}
      onClose={handleClose}
      title="지로수납처리"
      subtitle="은행에서 받은 지로 수납 파일을 첨부해 주세요"
      look="canon-wide"
      footer={
        <DepositUploadFooter
          amount={total}
          count={processableRows.length}
          disabled={!file || parseFileAction.isPending || isPeriodDataLoading || processableRows.length === 0 || isProcessing || recordGiroPayments.isPending}
          pending={isProcessing || recordGiroPayments.isPending}
          onProcess={() => void processPayments()}
        />
      }
    >
      {file ? (
        <>
          <FileDropzoneFileRow file={file} disabled={busy} onRemove={resetFile} />
          {parseFileAction.isPending || isPeriodDataLoading ? (
            <p role="status" className="mt-[12px] text-center text-[13px] font-medium text-t3">
              파일을 읽고 있어요…
            </p>
          ) : (
            <GiroPreviewTable rows={previewRows} completed={completed} />
          )}
        </>
      ) : (
        <FileDropzone
          helperText="e지로 수납 파일(GR15…)을 첨부할 수 있어요"
          disabled={busy}
          onFile={(nextFile) => void parseFile(nextFile)}
          ariaLabel="지로 수납 파일 첨부"
        />
      )}
    </ComplaintDialog>
  );
}
