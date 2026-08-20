"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button, EmptyState, Modal, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { type Building, useBuildings } from "@/hooks/reactquery/buildings";
import { useUnitOccupancyFull } from "@/hooks/reactquery/occupancies";
import { useUnitPayments } from "@/hooks/reactquery/payments";
import {
  type ReceiptFeeItemAmount,
  type ReceiptPaymentRow,
  useReceiptPaymentStatus,
} from "@/hooks/reactquery/receipts";
import { useUnits } from "@/hooks/reactquery/units";
import { hasModule } from "@/lib/auth/permissions";
import { currentPeriod, fromMonthInput, toMonthInput } from "@/lib/billing/period";
import { AsStatusSection } from "./components/AsStatusSection";
import { BuildingUnitRail } from "./components/BuildingUnitRail";
import { PaymentHistorySection } from "./components/PaymentHistorySection";
import { TenantInfoSection } from "./components/TenantInfoSection";
import { UnifiedSearchModal } from "./components/UnifiedSearchModal";
import { VillaPaymentModal, type VillaPaymentModalInit } from "./components/VillaPaymentModal";
import { downloadBankTemplate } from "./components/payment/bankTemplate";
import { formatCurrency } from "./receiptFormat";

type DropdownItem = { header: string } | { label: string; onClick: () => void };

function Dropdown({ label, items }: { label: string; items: DropdownItem[] }) {
  return (
    <details className="relative [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex h-10 cursor-pointer list-none items-center gap-1 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-t2 hover:bg-bg">
        {label} <span className="text-xs">▾</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 min-w-[190px] rounded-xl border border-line bg-surface p-1 shadow-card">
        {items.map((item, index) =>
          "header" in item ? (
            <p key={index} className="px-3 pb-1 pt-2 text-xs font-bold text-t4">
              {item.header}
            </p>
          ) : (
            <button
              key={index}
              type="button"
              onClick={(event) => {
                item.onClick();
                const details = event.currentTarget.closest("details");
                if (details) details.open = false;
              }}
              className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-t2 hover:bg-bg"
            >
              {item.label}
            </button>
          ),
        )}
      </div>
    </details>
  );
}

function MonthlyChargeModal({
  open,
  onClose,
  building,
  feeItems,
  rows,
  period,
}: {
  open: boolean;
  onClose: () => void;
  building: Building | null;
  feeItems: ReceiptFeeItemAmount[];
  rows: ReceiptPaymentRow[];
  period: string;
}) {
  const items = feeItems.filter((item) => building !== null && item.buildingId === building.id);
  const buildingRows = rows.filter((row) => building !== null && row.buildingId === building.id);
  const totals = buildingRows.reduce(
    (sum, row) => ({
      charged: sum.charged + (row.charged ?? 0),
      paid: sum.paid + row.paid,
      unpaid: sum.unpaid + (row.unpaid ?? 0),
    }),
    { charged: 0, paid: 0, unpaid: 0 },
  );
  const cards: [string, number][] = [
    ["총부과", totals.charged],
    ["수납", totals.paid],
    ["미납", totals.unpaid],
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`월별 부과금액 · ${toMonthInput(period)}`}
      className="max-w-lg"
    >
      {building === null ? (
        <p className="py-6 text-center text-sm text-t4">건물을 먼저 선택하세요</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm font-extrabold text-t1">{building.name}</p>
          <div className="grid grid-cols-3 gap-2">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-line bg-bg px-3 py-2">
                <p className="text-xs font-bold text-t3">{label}</p>
                <p className="mt-1 num text-sm font-extrabold text-t1">{formatCurrency(value)}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-t3">관리비 항목별 부과</p>
            {items.length === 0 ? (
              <p className="rounded-xl border border-line bg-bg px-3 py-3 text-xs text-t4">
                확정된 항목별 부과가 없습니다.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {items.map((item) => (
                  <span
                    key={item.feeItemId}
                    className="rounded-full bg-blue-t2 px-2.5 py-1 text-xs font-bold text-blue"
                  >
                    {item.feeItemName} {formatCurrency(item.amount)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ReceiptWorkspace({
  orgId,
  canSendMessages,
  canEditPayment,
}: {
  orgId: number;
  canSendMessages: boolean;
  canEditPayment: boolean;
}) {
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState(() => currentPeriod());
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(() => {
    const raw = searchParams.get("buildingId");
    const parsed = raw ? Number(raw) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [villa, setVilla] = useState<VillaPaymentModalInit | null>(null);

  const { data: buildings = [], isLoading: isBuildingsLoading } = useBuildings();
  const orgBuildings = useMemo(
    () => buildings.filter((building) => building.orgId === orgId),
    [buildings, orgId],
  );

  const { data: receiptData, isLoading: isReceiptLoading } = useReceiptPaymentStatus(
    orgBuildings,
    period,
    !isBuildingsLoading && orgBuildings.length > 0,
  );
  const receiptRows = receiptData.rows;

  const { data: units = [], isLoading: isUnitsLoading } = useUnits(selectedBuildingId ?? 0);
  const { data: occFull, isLoading: isOccLoading } = useUnitOccupancyFull(selectedUnitId ?? 0);
  const { data: unitPayments = [], isLoading: isPaymentsLoading } = useUnitPayments(
    selectedUnitId,
    period,
  );

  const selectedBuilding = orgBuildings.find((building) => building.id === selectedBuildingId) ?? null;
  const selectedSummary = receiptRows.find((row) => row.unitId === selectedUnitId);

  const selectBuilding = (id: number) => {
    setSelectedBuildingId(id);
    setSelectedUnitId(null);
  };
  const backToBuildings = () => {
    setSelectedBuildingId(null);
    setSelectedUnitId(null);
  };
  const jumpTo = (buildingId: number, unitId: number | null) => {
    setSelectedBuildingId(buildingId);
    setSelectedUnitId(unitId);
  };

  const openVilla = (init: VillaPaymentModalInit) => {
    if (selectedBuildingId === null) {
      toast.info("건물을 먼저 선택하세요.");
      return;
    }
    setVilla(init);
  };
  const openVillaUnit = (view: "statement" | "receipt") => {
    if (selectedBuildingId === null || selectedUnitId === null) {
      toast.info("호실을 먼저 선택하세요.");
      return;
    }
    setVilla({ view, unitId: selectedUnitId });
  };

  return (
    <div className="flex min-h-screen flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-bold text-t3">관리업무 · 수납관리</p>
          <h1 className="text-2xl font-extrabold text-t1">수납관리·민원접수</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            aria-label="조회월"
            value={toMonthInput(period)}
            onChange={(event) => {
              if (event.target.value) setPeriod(fromMonthInput(event.target.value));
            }}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-t1"
          />
          <Button type="button" onClick={() => setSearchOpen(true)}>
            조회
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMonthlyOpen(true)}>
            월별 부과금액
          </Button>
          {/* 빌라·호실·자동수납은 수납 콘솔(기록/취소 포함)이므로 payment 모듈 보유자만 노출 */}
          {canEditPayment && (
            <>
              <Dropdown
                label="빌라"
                items={[
                  { label: "빌라 부과금액", onClick: () => openVilla({ statusFilter: "all" }) },
                  { label: "빌라 미납내역", onClick: () => openVilla({ statusFilter: "unpaid" }) },
                  { label: "빌라 수납내역", onClick: () => openVilla({ statusFilter: "paid" }) },
                ]}
              />
              <Dropdown
                label="호실"
                items={[
                  { label: "호실 명세서", onClick: () => openVillaUnit("statement") },
                  { label: "영수증 출력", onClick: () => openVillaUnit("receipt") },
                ]}
              />
              {/* 지로처리일자 확인 = 지로원장(처리일자 포함) 뷰. 은행 양식 다운 = 업로드용 빈 xlsx 템플릿. */}
              <Dropdown
                label="자동수납"
                items={[
                  { header: "지로" },
                  { label: "지로수납처리", onClick: () => openVilla({ view: "table" }) },
                  { label: "지로수납원장 보기", onClick: () => openVilla({ view: "giro" }) },
                  { label: "지로처리일자 확인", onClick: () => openVilla({ view: "giro" }) },
                  { header: "은행 입금" },
                  { label: "은행 입금내역 업로드", onClick: () => openVilla({ view: "bank" }) },
                  { label: "은행 양식 다운", onClick: () => void downloadBankTemplate() },
                ]}
              />
            </>
          )}
        </div>
      </header>

      <div className="border-t border-line" />

      <div className="flex flex-col gap-4 lg:flex-row">
        <BuildingUnitRail
          buildings={orgBuildings}
          units={units}
          receiptRows={receiptRows}
          isUnitsLoading={isUnitsLoading}
          canEdit={canEditPayment}
          selectedBuildingId={selectedBuildingId}
          selectedUnitId={selectedUnitId}
          onSelectBuilding={selectBuilding}
          onSelectUnit={setSelectedUnitId}
          onBack={backToBuildings}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <PaymentHistorySection
            key={`pay-${selectedUnitId ?? "none"}`}
            hasUnit={selectedUnitId !== null}
            isLoading={isPaymentsLoading || isReceiptLoading}
            payments={unitPayments}
            summary={selectedSummary}
            period={period}
            unitId={selectedUnitId}
            canEdit={canEditPayment}
            canSendMessages={canSendMessages}
          />
          <TenantInfoSection
            key={`tenant-${selectedUnitId ?? "none"}`}
            data={occFull}
            isLoading={isOccLoading}
            hasUnit={selectedUnitId !== null}
            canEdit={canEditPayment}
          />
          <AsStatusSection
            orgId={orgId}
            buildingId={selectedBuildingId}
            unitId={selectedUnitId}
            canSendMessages={canSendMessages}
          />
        </div>
      </div>

      <UnifiedSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        buildings={orgBuildings}
        receiptRows={receiptRows}
        onJump={jumpTo}
      />
      <MonthlyChargeModal
        open={monthlyOpen}
        onClose={() => setMonthlyOpen(false)}
        building={selectedBuilding}
        feeItems={receiptData.feeItems}
        rows={receiptRows}
        period={period}
      />
      {villa && selectedBuilding && (
        <VillaPaymentModal
          open
          building={selectedBuilding}
          orgId={orgId}
          period={period}
          init={villa}
          onClose={() => setVilla(null)}
        />
      )}
    </div>
  );
}

export default function ReceiptManagementPage() {
  const { data: me } = useMe();

  if (me === undefined) return <Spinner />;
  if (!me || (!hasModule(me, "payment") && !hasModule(me, "complaints"))) {
    return (
      <div className="p-6">
        <EmptyState message="수납관리·민원접수 권한이 없습니다" />
      </div>
    );
  }

  return (
    <Suspense fallback={<Spinner />}>
      <ReceiptWorkspace
        orgId={me.orgId}
        canSendMessages={hasModule(me, "messaging")}
        canEditPayment={hasModule(me, "payment")}
      />
    </Suspense>
  );
}
