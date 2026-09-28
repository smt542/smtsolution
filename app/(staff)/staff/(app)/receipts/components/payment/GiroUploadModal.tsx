"use client";

import { useMemo, useState } from "react";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { useAsyncAction } from "@/hooks/common";
import { appToast as toast } from "@/hooks/common/useAppToast";
import {
  useGiroPayments,
  useRecordPayment,
} from "@/hooks/reactquery/payments";
import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import {
  DepositFileError,
  guessColumns,
  parseDepositFile,
  toDeposits,
  type Deposit,
} from "@/lib/payments/bankParse";
import {
  buildDepositPreview,
  type DepositPreviewRow,
  type DepositPreviewUnit,
} from "@/lib/payments/depositPreview";
import { formatWon } from "@/lib/format";
import { ComplaintDialog } from "../ComplaintDialog";
import { DepositUploadFooter } from "./DepositUploadFooter";
import { FileDropzone, FileDropzoneFileRow } from "./FileDropzone";
import { giroTableClass, giroTdClass, giroThClass, giroWrapClass } from "./giroClasses";

interface GiroUploadModalProps {
  open: boolean;
  period: string;
  rows: ReceiptPaymentRow[];
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

function locationValues(row: DepositPreviewRow, period: string) {
  if (!row.unit) return { buildingCode: "", buildingName: "", unitNo: "", year: "", month: "" };
  const dong = row.unit.dong?.trim();
  return {
    buildingCode: row.unit.buildingCode ?? "",
    buildingName: row.unit.buildingName ?? "",
    unitNo: dong ? `${dong} ${row.unit.unitNo}` : row.unit.unitNo,
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
  period,
  completed,
}: {
  rows: DepositPreviewRow[];
  period: string;
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
            const isDone = completed.has(row.deposit.rowIndex);
            const location = locationValues(row, period);
            const error = isDone ? "-" : row.error === "정상" ? "-" : row.error;
            // 반영을 마친 행은 다시 조회된 지로 수납과 겹쳐 '이중수납'으로 판정되므로 완료 표시를 우선한다.
            const duplicateDate = !isDone && row.error === "이중수납" ? dateDots(row.deposit.paidAt) : "-";
            return (
              <tr key={row.deposit.rowIndex}>
                <GiroPreviewCell value={String(index + 1)} done={isDone} className="num text-right" />
                <GiroPreviewCell value={dateDots(row.deposit.paidAt)} done={isDone} />
                <GiroPreviewCell value={row.deposit.paidAt ?? "-"} done={isDone} />
                <GiroPreviewCell value={row.dueStatus} done={isDone}>
                  {row.dueStatus === "납기후" ? <span className="text-red">납기후</span> : row.dueStatus}
                </GiroPreviewCell>
                <GiroPreviewCell value={location.buildingCode} done={isDone} />
                <GiroPreviewCell value={location.buildingName} done={isDone} />
                <GiroPreviewCell value={location.unitNo} done={isDone} />
                <GiroPreviewCell value={location.year} done={isDone} className="num" />
                <GiroPreviewCell value={location.month} done={isDone} className="num" />
                <GiroPreviewCell value={amountText(row.deposit.amount)} done={isDone} className="num text-right" />
                <GiroPreviewCell value={error} done={isDone}>
                  {error === "-" ? error : <span className="text-red">{error}</span>}
                </GiroPreviewCell>
                <GiroPreviewCell value="-" done={isDone} className="text-right" />
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

export function GiroUploadModal({ open, period, rows, onClose }: GiroUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const parseFileAction = useAsyncAction();
  const confirm = useConfirm();
  const recordPayment = useRecordPayment();
  const { data: giroPayments = [] } = useGiroPayments(null, period);
  const activeGiroPayments = useMemo(
    () => giroPayments
      .filter((payment) => payment.status === "active")
      .map((payment) => ({
        unitId: payment.unitId,
        amount: payment.amount,
        paidAt: payment.paidAt,
      })),
    [giroPayments],
  );
  const previewRows = useMemo(
    () => buildDepositPreview(deposits, toPreviewUnits(rows), activeGiroPayments),
    [activeGiroPayments, deposits, rows],
  );
  const processableRows = useMemo(
    () => previewRows.filter((row) => row.error === "정상" && !completed.has(row.deposit.rowIndex)),
    [completed, previewRows],
  );
  const total = useMemo(
    () => processableRows.reduce((sum, row) => sum + row.deposit.amount, 0),
    [processableRows],
  );
  const busy = parseFileAction.isPending || isProcessing;

  const resetFile = () => {
    if (busy) return;
    setFile(null);
    setDeposits([]);
    setCompleted(new Set());
  };

  const parseFile = async (nextFile: File) => {
    setFile(nextFile);
    setCompleted(new Set());
    await parseFileAction.run(async () => {
      try {
        const parsed = await parseDepositFile(nextFile);
        const mapping = guessColumns(parsed.headers);
        if (mapping.amount == null || (mapping.customerNo == null && mapping.name == null)) {
          toast.warning("입금내역 머리글을 읽지 못했어요");
          setFile(null);
          setDeposits([]);
          return;
        }
        setDeposits(toDeposits(parsed.rows, mapping));
      } catch (error) {
        toast.warning(
          error instanceof DepositFileError && error.code === "unsupported-xls"
            ? error.message
            : "입금내역 파일을 읽지 못했어요",
        );
        setFile(null);
        setDeposits([]);
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
    const doneRows = new Set(completed);
    let failed = 0;
    try {
      for (const row of processableRows) {
        if (!row.unit) {
          failed += 1;
          continue;
        }
        try {
          await recordPayment.mutateAsync({
            unitId: row.unit.unitId,
            period,
            amount: row.deposit.amount,
            method: "giro",
            kind: "full",
            memo: row.deposit.name || null,
            paidAt: row.deposit.paidAt,
            fee: 0,
          });
          doneRows.add(row.deposit.rowIndex);
        } catch {
          failed += 1;
        }
        setCompleted(new Set(doneRows));
      }
    } finally {
      setIsProcessing(false);
    }

    if (failed === 0) {
      toast.success(`${processableRows.length}건을 수납 반영했어요`);
      onClose();
    } else {
      toast.error(`${failed}건은 반영하지 못했어요`);
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
          disabled={!file || parseFileAction.isPending || processableRows.length === 0 || isProcessing}
          pending={isProcessing}
          onProcess={() => void processPayments()}
        />
      }
    >
      {file ? (
        <>
          <FileDropzoneFileRow file={file} disabled={busy} onRemove={resetFile} />
          {parseFileAction.isPending ? (
            <p role="status" className="mt-[12px] text-center text-[13px] font-medium text-t3">
              파일을 읽고 있어요…
            </p>
          ) : (
            <GiroPreviewTable rows={previewRows} period={period} completed={completed} />
          )}
        </>
      ) : (
        <FileDropzone
          accept=".txt"
          helperText="txt 파일만 첨부할 수 있어요"
          rejectText="txt 파일만 첨부할 수 있어요"
          disabled={busy}
          onFile={(nextFile) => void parseFile(nextFile)}
          ariaLabel="지로 수납 파일 첨부"
        />
      )}
    </ComplaintDialog>
  );
}
