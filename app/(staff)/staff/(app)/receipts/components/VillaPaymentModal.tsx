"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Button, Modal, SearchBar, Select, Spinner } from "@/components/common";
import { useBillOrganizationName } from "@/hooks/reactquery/bill";
import type { Building } from "@/hooks/reactquery/buildings";
import {
  cmsDownloadUrl,
  useCancelPayment,
  usePaymentRows,
  useRecordPayment,
  type PaymentKind,
  type PaymentMethod,
  type PaymentRow,
  type UnitPayment,
} from "@/hooks/reactquery/payments";
import { PROGRAM_COMPANY_NAME } from "@/lib/bill/document";
import { toMonthInput } from "@/lib/billing/period";
import { GiroCalendarModal } from "./payment/GiroCalendarModal";
import { GiroLedgerModal } from "./payment/GiroLedgerModal";
import { GiroUploadModal } from "./payment/GiroUploadModal";
import { PaymentAmountModal } from "./payment/PaymentAmountModal";
import { PaymentHistoryModal } from "./payment/PaymentHistoryModal";
import { PaymentReceiptModal } from "./payment/PaymentReceiptModal";
import { PaymentStatementModal } from "./payment/PaymentStatementModal";
import { PaymentTable } from "./payment/PaymentTable";

const BankImportModal = dynamic(
  () => import("./payment/BankImportModal").then((module) => module.BankImportModal),
  { ssr: false, loading: () => <Spinner /> },
);

export type VillaInitialView =
  | "table"
  | "giro-upload"
  | "giro"
  | "giro-calendar"
  | "bank"
  | "statement"
  | "receipt";
export type VillaStatusFilter = "all" | "unpaid" | "paid";

export interface VillaPaymentModalInit {
  view?: VillaInitialView;
  statusFilter?: VillaStatusFilter;
  unitId?: number | null;
}

type AmountModalState = { row: PaymentRow; kind: PaymentKind; method?: PaymentMethod };
type ReceiptState = { row: PaymentRow; payment: UnitPayment };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/**
 * 빌라(건물 전체) 수납 콘솔 모달 — 구 /staff/payment 페이지 흡수(P3).
 * 건물·부과월은 상위 수납관리 셸에서 선택된 값을 사용한다.
 */
export function VillaPaymentModal({
  open,
  onClose,
  building,
  orgId,
  period,
  init,
}: {
  open: boolean;
  onClose: () => void;
  building: Building;
  orgId: number;
  period: string;
  init?: VillaPaymentModalInit;
}) {
  const { data: organizationName } = useBillOrganizationName(orgId);
  const companyName = organizationName ?? PROGRAM_COMPANY_NAME;

  const {
    data: rows = [],
    isLoading,
    isError,
    refetch,
  } = usePaymentRows(building.id, period);
  const recordPayment = useRecordPayment();
  const cancelPayment = useCancelPayment();

  const [statusFilter, setStatusFilter] = useState<VillaStatusFilter>(init?.statusFilter ?? "all");
  const [search, setSearch] = useState("");
  const [amountModal, setAmountModal] = useState<AmountModalState | null>(null);
  const [historyRow, setHistoryRow] = useState<PaymentRow | null>(null);
  const [statementState, setStatementState] = useState<{ unitId: number | null } | null>(
    init?.view === "statement" ? { unitId: init.unitId ?? null } : null,
  );
  const [receiptState, setReceiptState] = useState<ReceiptState | null>(null);
  const [bankOpen, setBankOpen] = useState(init?.view === "bank");
  const [giroOpen, setGiroOpen] = useState(init?.view === "giro");
  const [giroUploadOpen, setGiroUploadOpen] = useState(init?.view === "giro-upload");
  const [giroCalendarOpen, setGiroCalendarOpen] = useState(
    init?.view === "giro-calendar",
  );
  // 호실 영수증 진입: rows 로드 후 해당 세대 이력 자동 오픈(사용자 조작 전까지).
  const [receiptDismissed, setReceiptDismissed] = useState(false);

  const autoReceiptRow =
    !receiptDismissed && init?.view === "receipt" && init.unitId
      ? rows.find((row) => row.unitId === init.unitId) ?? null
      : null;
  const activeHistoryRow = historyRow ?? autoReceiptRow;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("ko-KR");
    return rows.filter((row) => {
      if (statusFilter === "unpaid" && !(row.unpaid && row.unpaid > 0)) return false;
      if (statusFilter === "paid" && !(row.paid > 0)) return false;
      if (!q) return true;
      return [row.tenantName, row.unitNo, row.dong]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(q);
    });
  }, [rows, search, statusFilter]);

  const openAction = (row: PaymentRow, action: PaymentKind | "cancel" | "giro") => {
    if (action === "cancel") {
      setReceiptDismissed(true);
      setHistoryRow(row);
      return;
    }
    if (action === "giro") {
      setAmountModal({ row, kind: "full", method: "giro" });
      return;
    }
    setAmountModal({ row, kind: action });
  };

  const submitPayment = async (
    value: Parameters<React.ComponentProps<typeof PaymentAmountModal>["onSubmit"]>[0],
  ) => {
    if (!amountModal) return;
    try {
      await recordPayment.mutateAsync({
        unitId: amountModal.row.unitId,
        period,
        amount: value.amount,
        method: value.method,
        kind: amountModal.kind,
        memo: value.memo,
        paidAt: value.paidAt,
      });
      toast.success("수납 처리가 완료되었습니다.");
    } catch (error) {
      toast.error(errorMessage(error, "수납 처리에 실패했습니다."));
      throw error;
    }
  };

  const cancelRecordedPayment = async (paymentId: number) => {
    try {
      await cancelPayment.mutateAsync(paymentId);
      toast.success("수납 내역을 취소했습니다.");
    } catch (error) {
      toast.error(errorMessage(error, "수납 취소에 실패했습니다."));
    }
  };

  const defaultAmount = amountModal
    ? amountModal.kind === "partial"
      ? amountModal.row.unpaid && amountModal.row.unpaid > 0
        ? amountModal.row.unpaid
        : 0
      : amountModal.row.unpaid ?? 0
    : 0;

  const downloadCms = () => {
    const anchor = document.createElement("a");
    anchor.href = cmsDownloadUrl(building.id, period);
    anchor.rel = "noopener";
    anchor.click();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={`빌라 수납현황 · ${building.name} · ${toMonthInput(period)}`}
        className="max-w-6xl"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Select
              aria-label="수납상태 필터"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VillaStatusFilter)}
              options={[
                { value: "all", label: "전체" },
                { value: "unpaid", label: "미납" },
                { value: "paid", label: "수납" },
              ]}
            />
            <div className="w-56">
              <SearchBar value={search} onChange={setSearch} placeholder="입주자·호실·동 검색" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setStatementState({ unitId: null })}>
              수납명세서 출력
            </Button>
            <Button type="button" variant="ghost" onClick={() => setGiroUploadOpen(true)}>
              지로 처리
            </Button>
            <Button type="button" variant="ghost" onClick={() => setGiroOpen(true)}>
              지로 원장
            </Button>
            <Button type="button" variant="ghost" onClick={() => setGiroCalendarOpen(true)}>
              지로 일자별
            </Button>
            <Button type="button" variant="ghost" onClick={downloadCms}>
              자동이체 세대 다운
            </Button>
            <Button type="button" onClick={() => setBankOpen(true)}>
              엑셀 업로드
            </Button>
          </div>
        </div>

        <div className="mt-4 max-h-[60vh] overflow-y-auto">
          {isError ? (
            <div className="rounded-2xl border border-red/20 bg-red-t p-8 text-center">
              <p className="text-sm font-semibold text-red">수납 목록을 불러오지 못했습니다.</p>
              <Button type="button" variant="ghost" className="mt-4" onClick={() => void refetch()}>
                다시 시도
              </Button>
            </div>
          ) : (
            <PaymentTable
              rows={filteredRows}
              isLoading={isLoading}
              onAction={openAction}
              onStatement={(row) => setStatementState({ unitId: row.unitId })}
            />
          )}
        </div>
      </Modal>

      {amountModal && (
        <PaymentAmountModal
          open
          row={amountModal.row}
          kind={amountModal.kind}
          defaultAmount={defaultAmount}
          defaultMethod={amountModal.method ?? "transfer"}
          isPending={recordPayment.isPending}
          onClose={() => setAmountModal(null)}
          onSubmit={submitPayment}
        />
      )}

      {activeHistoryRow !== null && (
        <PaymentHistoryModal
          open
          unitId={activeHistoryRow.unitId}
          period={period}
          isPending={cancelPayment.isPending}
          onClose={() => {
            setHistoryRow(null);
            setReceiptDismissed(true);
          }}
          onCancel={cancelRecordedPayment}
          onReceipt={(payment) => {
            setReceiptState({ row: activeHistoryRow, payment });
            setHistoryRow(null);
            setReceiptDismissed(true);
          }}
        />
      )}

      {giroUploadOpen && (
        <GiroUploadModal
          open
          buildingId={building.id}
          period={period}
          onClose={() => setGiroUploadOpen(false)}
        />
      )}

      {giroOpen && (
        <GiroLedgerModal
          open
          buildingId={building.id}
          buildingName={building.name}
          period={period}
          onClose={() => setGiroOpen(false)}
        />
      )}

      {giroCalendarOpen && (
        <GiroCalendarModal
          open
          buildingId={building.id}
          period={period}
          onClose={() => setGiroCalendarOpen(false)}
        />
      )}

      {bankOpen && (
        <BankImportModal
          open
          buildingId={building.id}
          period={period}
          rows={rows}
          onClose={() => setBankOpen(false)}
        />
      )}

      {statementState && (
        <PaymentStatementModal
          building={building}
          companyName={companyName}
          currentPeriod={period}
          currentRows={rows}
          initialUnitId={statementState.unitId}
          onClose={() => setStatementState(null)}
        />
      )}

      {receiptState && (
        <PaymentReceiptModal
          building={building}
          companyName={companyName}
          row={receiptState.row}
          payment={receiptState.payment}
          period={period}
          onClose={() => setReceiptState(null)}
        />
      )}
    </>
  );
}
