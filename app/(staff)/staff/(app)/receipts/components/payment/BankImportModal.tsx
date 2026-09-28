"use client";

import { useMemo, useState } from "react";
import { useConfirm } from "@/components/common/ConfirmProvider";
import { useAsyncAction } from "@/hooks/common";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useBankPayments, useRecordBankPayments } from "@/hooks/reactquery/payments";
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
import {
  giroTdClass,
  giroThClass,
  giroWrapClass,
} from "./giroClasses";

interface BankImportModalProps {
  open: boolean;
  buildingId: number | null;
  period: string;
  rows: ReceiptPaymentRow[];
  onClose: () => void;
}

const BANK_COLUMN_WIDTH_CLASSES = [
  "w-[5.773%]", "w-[13.058%]", "w-[13.383%]", "w-[8.151%]", "w-[6.920%]", "w-[12.649%]",
  "w-[6.920%]", "w-[7.927%]", "w-[5.910%]", "w-[10.362%]", "w-[8.945%]",
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

function titleValue(value: string) {
  return value || undefined;
}

function dateSlash(value: string | null) {
  return value ? value.replace(/-/g, "/") : "-";
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

function PreviewCell({
  value,
  className = "",
  children,
}: {
  value: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <td
      className={`${giroTdClass} max-w-0 overflow-hidden text-ellipsis ${className}`}
      title={titleValue(value)}
    >
      {children ?? value}
    </td>
  );
}

function BankPreviewTable({ rows, period }: { rows: DepositPreviewRow[]; period: string }) {
  return (
    <div className={giroWrapClass}>
      <table className="w-full min-w-0 table-fixed border-collapse whitespace-nowrap [&_tbody_tr:last-child_td]:border-b-0">
        <colgroup>
          {BANK_COLUMN_WIDTH_CLASSES.map((widthClass, index) => (
            <col key={index} className={widthClass} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className={`${giroThClass} text-right`}>No</th>
            <th className={giroThClass}>지로입금일</th>
            <th className={giroThClass}>수납일</th>
            <th className={giroThClass}>구분</th>
            <th className={giroThClass}>동</th>
            <th className={giroThClass}>빌라명</th>
            <th className={giroThClass}>호</th>
            <th className={giroThClass}>년</th>
            <th className={giroThClass}>월</th>
            <th className={`${giroThClass} text-right`}>수납액</th>
            <th className={giroThClass}>에러체크</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const location = locationValues(row, period);
            const dueAfter = row.dueStatus === "납기후";
            return (
              <tr key={row.deposit.rowIndex}>
                <PreviewCell value={String(index + 1)} className="num text-right" />
                <PreviewCell value={dateSlash(row.deposit.paidAt)} />
                <PreviewCell value={row.deposit.paidAt ?? "-"} />
                <PreviewCell value={row.dueStatus}>
                  {dueAfter ? <span className="text-red">납기후</span> : row.dueStatus}
                </PreviewCell>
                <PreviewCell value={location.buildingCode} />
                <PreviewCell value={location.buildingName} />
                <PreviewCell value={location.unitNo} />
                <PreviewCell value={location.year} className="num" />
                <PreviewCell value={location.month} className="num" />
                <PreviewCell value={amountText(row.deposit.amount)} className="num text-right" />
                <PreviewCell value={row.error}>
                  {row.error === "정상" ? row.error : <span className="text-red">{row.error}</span>}
                </PreviewCell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function BankImportModal({
  open,
  buildingId,
  period,
  rows,
  onClose,
}: BankImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const parseFileAction = useAsyncAction();
  const confirm = useConfirm();
  const recordBankPayments = useRecordBankPayments();
  const { data: bankPayments = [] } = useBankPayments(buildingId, period);
  const previewRows = useMemo(
    () => buildDepositPreview(deposits, toPreviewUnits(rows), bankPayments),
    [bankPayments, deposits, rows],
  );
  const normalRows = useMemo(
    () => previewRows.filter((row) => row.error === "정상"),
    [previewRows],
  );
  const total = useMemo(
    () => normalRows.reduce((sum, row) => sum + row.deposit.amount, 0),
    [normalRows],
  );
  const busy = parseFileAction.isPending || recordBankPayments.isPending;

  const resetFile = () => {
    if (busy) return;
    setFile(null);
    setDeposits([]);
  };

  const parseFile = async (nextFile: File) => {
    setFile(nextFile);
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
    if (normalRows.length === 0 || busy) return;
    const accepted = await confirm({
      look: "check",
      title: "은행 입금을 반영하시겠습니까?",
      description: (
        <>
          처리 대상 <b>{normalRows.length}건</b> · 수납액 <b>{formatWon(total)}</b>
          <br />
          반영하면 해당 세대의 수납 이력에 기록됩니다.
        </>
      ),
      confirmLabel: "반영",
    });
    if (!accepted || busy) return;

    try {
      const result = await recordBankPayments.mutateAsync({
        buildingId,
        period,
        entries: normalRows.map((row) => ({
          unitId: row.unit?.unitId ?? 0,
          amount: row.deposit.amount,
          paidAt: row.deposit.paidAt,
          memo: row.deposit.name,
        })),
      });
      toast.success(`${result.recorded}건을 수납 반영했어요`);
      if (result.duplicate > 0) {
        toast.info(`${result.duplicate}건은 이미 반영돼 있어 건너뛰었어요`);
      }
      onClose();
    } catch (error) {
      toast.error(error, "은행 입금을 수납 반영하지 못했어요");
    }
  };

  return (
    <ComplaintDialog
      open={open}
      onClose={handleClose}
      title="은행 입금내역 업로드"
      subtitle="은행에서 내려받은 입금내역 엑셀을 첨부해 주세요"
      look="canon-wide"
      footer={
        <DepositUploadFooter
          amount={total}
          count={normalRows.length}
          disabled={!file || parseFileAction.isPending || normalRows.length === 0 || recordBankPayments.isPending}
          pending={recordBankPayments.isPending}
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
            <BankPreviewTable rows={previewRows} period={period} />
          )}
        </>
      ) : (
        <FileDropzone
          accept=".xlsx,.xls,.csv"
          helperText="xlsx · xls · csv 파일을 첨부할 수 있어요"
          rejectText="xlsx · xls · csv 파일만 첨부할 수 있어요"
          disabled={busy}
          onFile={(nextFile) => void parseFile(nextFile)}
          ariaLabel="은행 입금내역 엑셀 첨부"
        />
      )}
    </ComplaintDialog>
  );
}
