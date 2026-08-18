"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, EmptyState, SearchBar, Select, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillOrganizationName } from "@/hooks/reactquery/bill";
import { useBuildings } from "@/hooks/reactquery/buildings";
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
import { hasModule } from "@/lib/auth/permissions";
import { PROGRAM_COMPANY_NAME } from "@/lib/bill/document";
import { currentPeriod, fromMonthInput, toMonthInput } from "@/lib/billing/period";
import { BankImportModal } from "./components/BankImportModal";
import { GiroLedgerModal } from "./components/GiroLedgerModal";
import { PaymentAmountModal } from "./components/PaymentAmountModal";
import { PaymentHistoryModal } from "./components/PaymentHistoryModal";
import { PaymentReceiptModal } from "./components/PaymentReceiptModal";
import { PaymentStatementModal } from "./components/PaymentStatementModal";
import { PaymentTable } from "./components/PaymentTable";

type AmountModalState = {
  row: PaymentRow;
  kind: PaymentKind;
  method?: PaymentMethod;
};

type ReceiptState = {
  row: PaymentRow;
  payment: UnitPayment;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function PaymentProcessing({ orgId }: { orgId: number }) {
  const { data: buildings = [], isLoading: areBuildingsLoading } = useBuildings();
  const { data: organizationName } = useBillOrganizationName(orgId);
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [period, setPeriod] = useState(() => currentPeriod());
  const [search, setSearch] = useState("");
  const [amountModal, setAmountModal] = useState<AmountModalState | null>(null);
  const [historyRow, setHistoryRow] = useState<PaymentRow | null>(null);
  const [statementState, setStatementState] = useState<{ unitId: number | null } | null>(null);
  const [receiptState, setReceiptState] = useState<ReceiptState | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [giroOpen, setGiroOpen] = useState(false);

  const organizationBuildings = useMemo(
    () => buildings.filter((building) => building.orgId === orgId),
    [buildings, orgId],
  );
  const selectedBuildingId = buildingId ?? organizationBuildings[0]?.id ?? null;
  const selectedBuilding = organizationBuildings.find(
    (building) => building.id === selectedBuildingId,
  ) ?? null;
  const companyName = organizationName ?? PROGRAM_COMPANY_NAME;
  const {
    data: rows = [],
    isLoading: areRowsLoading,
    isError: isRowsError,
    refetch,
  } = usePaymentRows(selectedBuildingId, period);
  const recordPayment = useRecordPayment();
  const cancelPayment = useCancelPayment();

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("ko-KR");
    if (!normalizedSearch) return rows;

    return rows.filter((row) =>
      [row.tenantName, row.unitNo, row.dong]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko-KR")
        .includes(normalizedSearch),
    );
  }, [rows, search]);

  const openAction = (row: PaymentRow, action: PaymentKind | "cancel" | "giro") => {
    if (action === "cancel") {
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
      setAmountModal(null);
      toast.success("수납 처리가 완료되었습니다.");
    } catch (error) {
      toast.error(errorMessage(error, "수납 처리에 실패했습니다."));
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

  return (
    <>
      <div className="flex min-h-screen flex-col gap-5 p-4 print:hidden sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-t3">관리업무 · 수납 처리</p>
          <h1 className="mt-1 text-2xl font-extrabold text-t1">수납 처리</h1>
          <p className="mt-2 text-sm text-t2">
            월별 부과와 수납 현황을 확인하고 수납 등록 또는 취소를 처리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={selectedBuildingId === null}
            onClick={() => setStatementState({ unitId: null })}
          >
            수납명세서 출력
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={selectedBuildingId === null}
            onClick={() => setGiroOpen(true)}
          >
            지로 원장
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={selectedBuildingId === null}
            onClick={() => {
              if (selectedBuildingId === null) return;
              const anchor = document.createElement("a");
              anchor.href = cmsDownloadUrl(selectedBuildingId, period);
              anchor.rel = "noopener";
              anchor.click();
            }}
          >
            자동이체 세대 다운
          </Button>
          <Button
            type="button"
            disabled={selectedBuildingId === null}
            onClick={() => setBankOpen(true)}
          >
            엑셀 업로드
          </Button>
        </div>
      </header>

      <section
        aria-label="수납 조회 조건"
        className="rounded-2xl border border-line bg-surface p-4 shadow-card"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_160px_minmax(240px,1.5fr)]">
          <label className="space-y-1.5 text-xs font-bold text-t2">
            건물
            <Select
              aria-label="건물 선택"
              value={selectedBuildingId?.toString() ?? ""}
              disabled={areBuildingsLoading || organizationBuildings.length === 0}
              onChange={(event) => setBuildingId(Number(event.target.value))}
              options={
                organizationBuildings.length > 0
                  ? organizationBuildings.map((building) => ({
                      value: String(building.id),
                      label: building.name,
                    }))
                  : [{ value: "", label: areBuildingsLoading ? "불러오는 중…" : "등록된 건물 없음" }]
              }
            />
          </label>

          <label className="space-y-1.5 text-xs font-bold text-t2">
            부과월
            <input
              type="month"
              aria-label="부과월"
              value={toMonthInput(period)}
              onChange={(event) => {
                if (event.target.value) setPeriod(fromMonthInput(event.target.value));
              }}
              className="h-11 w-full rounded-xl border border-line bg-surface px-4 text-sm text-t1 focus:border-brand focus:outline-none"
            />
          </label>

          <label className="space-y-1.5 text-xs font-bold text-t2">
            검색
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="입주자·호실·동 검색"
            />
          </label>
        </div>
      </section>

      {isRowsError ? (
        <section className="rounded-2xl border border-red/20 bg-red-t p-8 text-center">
          <p className="text-sm font-semibold text-red">
            수납 목록을 불러오지 못했습니다. 다시 시도해 주세요.
          </p>
          <Button type="button" variant="ghost" className="mt-4" onClick={() => void refetch()}>
            다시 시도
          </Button>
        </section>
      ) : selectedBuildingId === null && !areBuildingsLoading ? (
        <section className="rounded-2xl border border-line bg-surface shadow-card">
          <EmptyState message="등록된 건물이 없습니다" />
        </section>
      ) : (
        <PaymentTable
          rows={filteredRows}
          isLoading={areBuildingsLoading || areRowsLoading}
          onAction={openAction}
          onStatement={(row) => setStatementState({ unitId: row.unitId })}
        />
      )}

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

      {historyRow !== null && (
        <PaymentHistoryModal
          open
          unitId={historyRow.unitId}
          period={period}
          isPending={cancelPayment.isPending}
          onClose={() => setHistoryRow(null)}
          onCancel={cancelRecordedPayment}
          onReceipt={(payment) => {
            setReceiptState({ row: historyRow, payment });
            setHistoryRow(null);
          }}
        />
      )}

      {giroOpen && selectedBuildingId !== null && (
        <GiroLedgerModal
          open
          buildingId={selectedBuildingId}
          period={period}
          isPending={cancelPayment.isPending}
          onClose={() => setGiroOpen(false)}
          onCancel={cancelRecordedPayment}
        />
      )}

      {bankOpen && selectedBuildingId !== null && (
        <BankImportModal
          open
          buildingId={selectedBuildingId}
          period={period}
          rows={rows}
          onClose={() => setBankOpen(false)}
        />
      )}
      </div>

      {statementState && selectedBuilding && (
        <PaymentStatementModal
          building={selectedBuilding}
          companyName={companyName}
          currentPeriod={period}
          currentRows={rows}
          initialUnitId={statementState.unitId}
          onClose={() => setStatementState(null)}
        />
      )}

      {receiptState && selectedBuilding && (
        <PaymentReceiptModal
          building={selectedBuilding}
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

export default function PaymentProcessingPage() {
  const { data: me } = useMe();

  if (me === undefined) return <Spinner />;
  if (!me || !hasModule(me, "payment")) {
    return (
      <div className="p-6">
        <EmptyState message="수납 처리 권한이 없습니다" />
      </div>
    );
  }

  return <PaymentProcessing orgId={me.orgId} />;
}
