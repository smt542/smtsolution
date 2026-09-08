"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { EmptyState, Spinner } from "@/components/common";
import { PrinterIcon } from "@/components/icons";
import { useMe } from "@/hooks/reactquery/auth";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useUnitOccupancyFull } from "@/hooks/reactquery/occupancies";
import { useUnitPayments } from "@/hooks/reactquery/payments";
import { useReceiptPaymentStatus, useReceiptStatementData } from "@/hooks/reactquery/receipts";
import { useUnits } from "@/hooks/reactquery/units";
import { hasModule } from "@/lib/auth/permissions";
import { currentPeriod, prevPeriod } from "@/lib/billing/period";
import { AsStatusSection } from "./components/AsStatusSection";
import { BuildingUnitRail } from "./components/BuildingUnitRail";
import { PaymentHistorySection } from "./components/PaymentHistorySection";
import { TenantInfoSection } from "./components/TenantInfoSection";
import { UnifiedSearchModal } from "./components/UnifiedSearchModal";
import { ChargeReceiptReportModal } from "./components/ChargeReceiptReportModal";
import { VillaPaymentModal, type VillaPaymentModalInit } from "./components/VillaPaymentModal";
import { VillaOverdueModal } from "./components/villa-overdue/VillaOverdueModal";
import { ReceiptEntryAlerts } from "./components/entry-alerts/ReceiptEntryAlerts";
import { MonthlyChargeModal } from "./components/monthly/MonthlyChargeModal";
import { UnitStatementModal } from "./components/unit-statement/UnitStatementModal";
import { VillaReceiptHistoryModal } from "./components/villa-receipts/VillaReceiptHistoryModal";

type DropdownItem = { header: string } | { label: string; onClick: () => void };

async function downloadBankTemplate() {
  const bankTemplate = await import("./components/payment/bankTemplate");
  await bankTemplate.downloadBankTemplate();
}

function Dropdown({
  label,
  items,
  accent,
}: {
  label: string;
  items: DropdownItem[];
  accent?: "teal";
}) {
  const widthClass =
    label === "빌라" ? "w-[78px]" : label === "호실" ? "w-[76px]" : "w-[102px]";
  const summaryClass =
    accent === "teal"
      ? `flex h-10 ${widthClass} cursor-pointer list-none items-center justify-center gap-1 rounded-xl bg-teal px-3 text-sm font-bold text-white hover:bg-teal-d`
      : `flex h-10 ${widthClass} cursor-pointer list-none items-center justify-center gap-1 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-t2 hover:bg-bg`;
  return (
    <details className="relative [&_summary::-webkit-details-marker]:hidden">
      <summary className={summaryClass}>
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
  const [period] = useState(() => {
    const requested = searchParams.get("period");
    return requested && /^\d{4}-\d{2}-01$/.test(requested) ? requested : currentPeriod();
  });
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(() => {
    const raw = searchParams.get("buildingId");
    const parsed = raw ? Number(raw) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(() => {
    const raw = searchParams.get("unitId");
    const parsed = raw ? Number(raw) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [chargeReportOpen, setChargeReportOpen] = useState(false);
  const [receiptHistoryOpen, setReceiptHistoryOpen] = useState(false);
  const [unitStatementOpen, setUnitStatementOpen] = useState(false);
  const [villa, setVilla] = useState<VillaPaymentModalInit | null>(null);
  const [overdueOpen, setOverdueOpen] = useState(false);

  const { data: buildings = [] } = useBuildings();
  const orgBuildings = useMemo(
    () => buildings.filter((building) => building.orgId === orgId),
    [buildings, orgId],
  );

  const { data: receiptData, isLoading: isReceiptLoading } = useReceiptPaymentStatus(
    orgId,
    period,
  );
  const receiptRows = receiptData.rows;

  const { data: units = [], isLoading: isUnitsLoading } = useUnits(selectedBuildingId ?? 0);
  const { data: occFull, isLoading: isOccLoading } = useUnitOccupancyFull(selectedUnitId ?? 0);
  const { data: unitPayments = [], isLoading: isPaymentsLoading } = useUnitPayments(
    selectedUnitId,
    period,
  );
  const historyStartPeriod = useMemo(() => {
    let start = period;
    for (let index = 0; index < 4; index += 1) start = prevPeriod(start);
    return start;
  }, [period]);
  const historyQuery = useReceiptStatementData(
    selectedBuildingId ?? 0,
    selectedUnitId,
    historyStartPeriod,
    period,
    selectedBuildingId !== null && selectedUnitId !== null,
  );

  const selectedBuilding = orgBuildings.find((building) => building.id === selectedBuildingId) ?? null;
  const selectedUnit = units.find((unit) => unit.id === selectedUnitId) ?? null;
  const selectedUnitNo = selectedUnit?.unitNo ?? "";
  const selectedUnitLabel = selectedUnitNo
    ? `${selectedUnit?.dong ? `${selectedUnit.dong} ` : ""}${
        selectedUnitNo.endsWith("호") ? selectedUnitNo : `${selectedUnitNo}호`
      }`
    : "";
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
  const openOverdue = () => {
    if (selectedBuildingId === null) {
      toast.info("건물을 먼저 선택하세요.");
      return;
    }
    setOverdueOpen(true);
  };
  const requireBuilding = (open: () => void) => {
    if (selectedBuildingId === null) {
      toast.info("건물을 먼저 선택하세요.");
      return;
    }
    open();
  };
  const openUnitStatement = () => {
    if (selectedBuildingId === null || selectedUnitId === null) {
      toast.info("호실을 먼저 선택하세요.");
      return;
    }
    setUnitStatementOpen(true);
  };
  const openUnitReceipt = () => {
    if (selectedBuildingId === null || selectedUnitId === null) {
      toast.info("호실을 먼저 선택하세요.");
      return;
    }
    setVilla({ view: "receipt", unitId: selectedUnitId });
  };

  return (
    <div className="min-h-[calc(100vh-62px)] px-[24px] py-[18px]">
      <h1 className="sr-only">수납관리·민원접수</h1>

      <div className="fixed right-[24px] top-[11px] z-[30] hidden items-center gap-[8px] md:flex print:hidden">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="h-[40px] w-[58px] rounded-[11px] border border-line bg-surface text-[14px] font-bold text-t2 hover:bg-bg"
          >
            조회
          </button>
          <button
            type="button"
            onClick={() => setMonthlyOpen(true)}
            className="flex h-[40px] w-[132px] items-center justify-center gap-[7px] rounded-[11px] border border-line bg-surface text-[14px] font-bold text-t2 hover:bg-bg"
          >
            <PrinterIcon className="size-[15px]" aria-hidden="true" />
            월별 부과금액
          </button>
          {/* 빌라·호실·자동수납은 수납 콘솔(기록/취소 포함)이므로 payment 모듈 보유자만 노출 */}
          {canEditPayment && (
            <>
              <Dropdown
                label="빌라"
                items={[
                  {
                    label: "빌라 부과금액",
                    onClick: () => requireBuilding(() => setChargeReportOpen(true)),
                  },
                  { label: "빌라 미납내역", onClick: openOverdue },
                  {
                    label: "빌라 수납내역",
                    onClick: () => requireBuilding(() => setReceiptHistoryOpen(true)),
                  },
                ]}
              />
              <Dropdown
                label="호실"
                items={[
                  { label: "호실 명세서", onClick: openUnitStatement },
                  { label: "영수증 출력", onClick: openUnitReceipt },
                ]}
              />
              {/* 자동수납 메뉴는 각 Figma 모달로 바로 진입한다. */}
              <Dropdown
                label="자동수납"
                accent="teal"
                items={[
                  { header: "지로" },
                  { label: "지로수납처리", onClick: () => openVilla({ view: "giro-upload" }) },
                  { label: "지로수납원장 보기", onClick: () => openVilla({ view: "giro" }) },
                  {
                    label: "지로처리일자 확인",
                    onClick: () => openVilla({ view: "giro-calendar" }),
                  },
                  { header: "은행 입금" },
                  { label: "은행 입금내역 업로드", onClick: () => openVilla({ view: "bank" }) },
                  { label: "은행 양식 다운", onClick: () => void downloadBankTemplate() },
                ]}
              />
            </>
          )}
      </div>

      <div className="flex flex-col gap-[16px] lg:flex-row">
        <BuildingUnitRail
          key={selectedBuildingId ?? "all-buildings"}
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

        <div className="flex min-w-0 flex-1 flex-col gap-[10px]">
          <PaymentHistorySection
            key={`pay-${selectedUnitId ?? "none"}`}
            orgId={orgId}
            buildingId={selectedBuildingId}
            hasUnit={selectedUnitId !== null}
            isLoading={isPaymentsLoading || isReceiptLoading || historyQuery.isLoading}
            payments={historyQuery.data?.payments ?? unitPayments}
            historySummaries={historyQuery.data?.paymentRows.filter(
              (row) => row.unitId === selectedUnitId,
            )}
            summary={selectedSummary}
            period={period}
            unitId={selectedUnitId}
            canEdit={canEditPayment}
            canSendMessages={canSendMessages}
          />
          <TenantInfoSection
            key={`tenant-${selectedUnitId ?? "none"}`}
            orgId={orgId}
            buildingId={selectedBuildingId}
            period={period}
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
            resident={occFull?.occupancy ? {
              occupancyId: occFull.occupancy.id,
              name: occFull.occupancy.tenantName,
              phone: occFull.occupancy.phone,
              alimtalkOptIn: occFull.occupancy.alimtalkOptIn,
            } : null}
          />
        </div>
      </div>

      <button
        type="button"
        aria-label="상담 문의"
        onClick={() => toast.info("상담 문의 기능을 준비 중입니다.")}
        className="fixed bottom-[21px] right-[24px] z-20 hidden size-[52px] items-center justify-center rounded-full bg-teal text-white shadow-[0_8px_22px_rgba(8,117,108,0.28)] transition-colors hover:bg-teal-d md:flex print:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-[19px]" aria-hidden="true">
          <path d="M6.5 18.5 3.5 21v-5.3A7.5 7.5 0 0 1 4 5.5 9 9 0 0 1 18.8 7a7.2 7.2 0 0 1-.4 8.8A8.8 8.8 0 0 1 6.5 18.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <UnifiedSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        buildings={orgBuildings}
        receiptRows={receiptRows}
        period={period}
        onJump={jumpTo}
      />
      <MonthlyChargeModal
        open={monthlyOpen}
        onClose={() => setMonthlyOpen(false)}
        buildings={orgBuildings}
        period={period}
      />
      {chargeReportOpen && selectedBuilding && (
        <ChargeReceiptReportModal
          open
          onClose={() => setChargeReportOpen(false)}
          building={selectedBuilding}
          period={period}
        />
      )}
      {receiptHistoryOpen && selectedBuilding && (
        <VillaReceiptHistoryModal
          open
          onClose={() => setReceiptHistoryOpen(false)}
          building={selectedBuilding}
          period={period}
        />
      )}
      {unitStatementOpen && selectedBuilding && selectedUnitId !== null && (
        <UnitStatementModal
          open
          onClose={() => setUnitStatementOpen(false)}
          building={selectedBuilding}
          unitId={selectedUnitId}
          unitLabel={selectedUnitLabel}
          period={period}
        />
      )}
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
      {overdueOpen && selectedBuilding && (
        <VillaOverdueModal
          open
          building={selectedBuilding}
          orgId={orgId}
          period={period}
          onClose={() => setOverdueOpen(false)}
        />
      )}

      <ReceiptEntryAlerts />
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
