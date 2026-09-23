"use client";

import type { ReceiptPaymentRow } from "@/hooks/reactquery/receipts";
import { GiroCalendarModal } from "./GiroCalendarModal";
import { GiroLedgerModal } from "./GiroLedgerModal";
import { GiroUploadModal } from "./GiroUploadModal";
import { LazyBankImportModal } from "./BankImportModalLazy";

export type AutoPaymentView = "giro-upload" | "giro-ledger" | "giro-calendar" | "bank";

interface AutoPaymentModalsProps {
  view: AutoPaymentView | null;
  period: string;
  rows: ReceiptPaymentRow[];
  onClose: () => void;
}

/** 헤더 자동수납 메뉴의 모달 — 정본대로 건물 선택과 상관없이 조직 전체를 다룬다. */
export function AutoPaymentModals({
  view,
  period,
  rows,
  onClose,
}: AutoPaymentModalsProps) {
  if (view === null) return null;

  if (view === "giro-upload") {
    return <GiroUploadModal open period={period} onClose={onClose} />;
  }
  if (view === "giro-ledger") {
    return (
      <GiroLedgerModal
        open
        buildingId={null}
        period={period}
        rows={rows}
        onClose={onClose}
      />
    );
  }
  if (view === "giro-calendar") {
    return <GiroCalendarModal open buildingId={null} period={period} onClose={onClose} />;
  }
  return (
    <LazyBankImportModal
      open
      buildingId={null}
      period={period}
      rows={rows}
      onClose={onClose}
    />
  );
}
