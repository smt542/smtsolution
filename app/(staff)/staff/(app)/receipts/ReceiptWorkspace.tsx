"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { useIsHydrated } from "@/hooks/common";
import { Button, Spinner } from "@/components/common";
import { PrinterIcon } from "@/components/icons";
import { useBuildings } from "@/hooks/reactquery/buildings";
import { useUnitOccupancyFull } from "@/hooks/reactquery/occupancies";
import { useUnitPayments } from "@/hooks/reactquery/payments";
import { useReceiptPaymentStatus, useReceiptStatementData } from "@/hooks/reactquery/receipts";
import { useUnits } from "@/hooks/reactquery/units";
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
type ReceiptDropdownKey = "villa" | "unit" | "auto";

async function downloadBankTemplate() {
  const bankTemplate = await import("./components/payment/bankTemplate");
  await bankTemplate.downloadBankTemplate();
}

function Dropdown({
  label,
  items,
  accent,
  inactive,
  open,
  onOpenChange,
  onInactiveClick,
}: {
  label: string;
  items: DropdownItem[];
  accent?: "teal";
  inactive?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInactiveClick?: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isOpen = open && !inactive;
  const triggerClass =
    accent === "teal"
      ? "flex h-10 cursor-pointer items-center gap-[5px] rounded-[11px] border border-transparent bg-teal px-[15px] text-[13.5px] font-bold leading-[normal] text-white hover:bg-teal-d"
      : "flex h-10 cursor-pointer items-center gap-[5px] rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold leading-[normal] text-t2 hover:bg-bg";

  useEffect(() => {
    if (open && inactive) onOpenChange(false);
  }, [inactive, onOpenChange, open]);

  // 정본 `.rc-gmenu` 는 fixed 다: left = clamp(버튼 right - 메뉴 폭, 10, 창 폭 - 메뉴 폭 - 10),
  // top = 버튼 bottom + 6. 창 크기가 바뀌면 다시 잡는다.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const button = buttonRef.current;
      const menu = menuRef.current;
      if (!button || !menu) return;
      const rect = button.getBoundingClientRect();
      const width = menu.offsetWidth || 172;
      menu.style.left = `${Math.max(10, Math.min(rect.right - width, window.innerWidth - width - 10))}px`;
      menu.style.top = `${rect.bottom + 6}px`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [isOpen]);

  useEffect(() => {
    if (!open) return;

    const closeOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target)) onOpenChange(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onOpenChange, open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-disabled={inactive ? true : undefined}
        onClick={() => {
          if (inactive) {
            onInactiveClick?.();
            return;
          }
          onOpenChange(!isOpen);
        }}
        className={`${triggerClass}${inactive ? " opacity-45 transition-opacity" : ""}`}
      >
        {label}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="size-[15px]"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[60] min-w-[172px] rounded-[12px] border border-line bg-surface p-[6px] leading-[normal] shadow-[0_14px_34px_-10px_rgba(23,31,40,0.28)]"
        >
          {items.map((item, index) =>
            "header" in item ? (
              <p
                key={index}
                className="px-[11px] pb-[3px] pt-[7px] text-[10.5px] font-extrabold tracking-[.02em] text-t4"
              >
                {item.header}
              </p>
            ) : (
              <button
                key={index}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onClick();
                  onOpenChange(false);
                }}
                className="block w-full whitespace-nowrap rounded-[8px] px-[11px] py-[9px] text-left text-[13px] font-semibold text-t2 hover:bg-bg hover:text-t1"
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function ReceiptWorkspace({
  orgId,
  canSendMessages,
  canEditPayment,
  initialPeriod,
  initialBuildingId,
  initialUnitId,
}: {
  orgId: number;
  canSendMessages: boolean;
  canEditPayment: boolean;
  initialPeriod: string | null;
  initialBuildingId: number | null;
  initialUnitId: number | null;
}) {
  const [period] = useState(() => initialPeriod ?? currentPeriod());
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(initialBuildingId);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(initialUnitId);
  // 정본 `setView`: 레일이 건물 목록/호실 목록 중 무엇을 보이는지는 선택과 따로 논다.
  // 뒤로가기는 목록만 바꾸고 고른 건물·호실은 그대로 둔다(우측 패널도 유지).
  const [railView, setRailView] = useState<"building" | "unit">(
    initialBuildingId !== null ? "unit" : "building",
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [monthlyOpen, setMonthlyOpen] = useState(false);
  const [chargeReportOpen, setChargeReportOpen] = useState(false);
  const [receiptHistoryOpen, setReceiptHistoryOpen] = useState(false);
  const [unitStatementOpen, setUnitStatementOpen] = useState(false);
  const [villa, setVilla] = useState<VillaPaymentModalInit | null>(null);
  const [overdueOpen, setOverdueOpen] = useState(false);
  const isHydrated = useIsHydrated();
  const [openDropdown, setOpenDropdown] = useState<ReceiptDropdownKey | null>(null);

  const getDropdownProps = (key: ReceiptDropdownKey) => ({
    open: openDropdown === key,
    onOpenChange: (next: boolean) => {
      setOpenDropdown((current) => (next ? key : current === key ? null : current));
    },
  });

  const buildingsQuery = useBuildings();
  const orgBuildings = useMemo(
    () =>
      isHydrated
        ? (buildingsQuery.data ?? []).filter((building) => building.orgId === orgId)
        : [],
    [buildingsQuery.data, isHydrated, orgId],
  );

  const receiptQuery = useReceiptPaymentStatus(
    orgId,
    period,
  );
  const { data: receiptData, isLoading: isReceiptLoading } = receiptQuery;
  const receiptRows = receiptData.rows;

  const unitsQuery = useUnits(selectedBuildingId ?? 0);
  const { data: units = [], isLoading: isUnitsLoading } = unitsQuery;
  const occupancyQuery = useUnitOccupancyFull(selectedUnitId ?? 0);
  const { data: occFull, isLoading: isOccLoading } = occupancyQuery;
  const paymentsQuery = useUnitPayments(
    selectedUnitId,
    period,
  );
  const { data: unitPayments = [], isLoading: isPaymentsLoading } = paymentsQuery;
  // 정본 `drawHist` 는 당월 포함 7개월을 보인다.
  const historyStartPeriod = useMemo(() => {
    let start = period;
    for (let index = 0; index < 6; index += 1) start = prevPeriod(start);
    return start;
  }, [period]);
  const historyQuery = useReceiptStatementData(
    selectedBuildingId ?? 0,
    selectedUnitId,
    historyStartPeriod,
    period,
    selectedBuildingId !== null && selectedUnitId !== null,
  );
  const isPaymentHistoryLoading =
    isPaymentsLoading || isReceiptLoading || historyQuery.isLoading;
  const isReceiptWorkspaceRefreshing = [
    buildingsQuery,
    receiptQuery,
    unitsQuery,
    occupancyQuery,
    paymentsQuery,
    historyQuery,
  ].some((query) => query.isFetching && !query.isLoading);

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
    setRailView("unit");
  };
  const backToBuildings = () => {
    setRailView("building");
  };
  const jumpTo = (buildingId: number, unitId: number | null) => {
    setSelectedBuildingId(buildingId);
    setSelectedUnitId(unitId);
    setRailView("unit");
  };

  const openVilla = (init: VillaPaymentModalInit) => {
    if (selectedBuildingId === null) {
      toast.info("건물을 선택해 주세요");
      return;
    }
    setVilla(init);
  };
  const openOverdue = () => {
    if (selectedBuildingId === null) {
      toast.info("건물을 선택해 주세요");
      return;
    }
    setOverdueOpen(true);
  };
  const requireBuilding = (open: () => void) => {
    if (selectedBuildingId === null) {
      toast.info("건물을 선택해 주세요");
      return;
    }
    open();
  };
  const openUnitStatement = () => {
    if (selectedBuildingId === null || selectedUnitId === null) {
      toast.info("호실을 선택해 주세요");
      return;
    }
    setUnitStatementOpen(true);
  };
  const openUnitReceipt = () => {
    if (selectedBuildingId === null || selectedUnitId === null) {
      toast.info("호실을 선택해 주세요");
      return;
    }
    setVilla({ view: "receipt", unitId: selectedUnitId });
  };

  return (
    <div className="relative flex h-[calc(100vh-62px)] flex-col overflow-hidden px-[24px] pb-[22px] pt-[18px]">
      <h1 className="sr-only">수납관리·민원접수</h1>
      {isReceiptWorkspaceRefreshing ? (
        <div className="absolute right-6 top-3 z-40 rounded-lg bg-white/95 shadow-card">
          <Spinner label="수납관리 자료 갱신 중" size="small" showLabel className="px-3 py-2" />
        </div>
      ) : null}

      <div className="fixed right-[24px] top-[10.5px] z-[30] hidden items-center gap-[8px] md:flex print:hidden">
          <Button
            variant="ghost"
            type="button"
            onClick={() => setSearchOpen(true)}
            className="leading-[normal]"
          >
            조회
          </Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setMonthlyOpen(true)}
            className="leading-[normal]"
          >
            <PrinterIcon className="size-[16px]" aria-hidden="true" />
            월별 부과금액
          </Button>
          {/* 빌라·호실·자동수납은 수납 콘솔(기록/취소 포함)이므로 payment 모듈 보유자만 노출 */}
          {canEditPayment && (
            <>
              <Dropdown
                label="빌라"
                inactive={selectedBuildingId === null}
                onInactiveClick={() => toast.info("건물을 선택해 주세요")}
                {...getDropdownProps("villa")}
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
                inactive={selectedUnitId === null}
                onInactiveClick={() => toast.info("호실을 선택해 주세요")}
                {...getDropdownProps("unit")}
                items={[
                  { label: "호실 명세서", onClick: openUnitStatement },
                  { label: "영수증 출력", onClick: openUnitReceipt },
                ]}
              />
              {/* 자동수납 메뉴는 각 Figma 모달로 바로 진입한다. */}
              <Dropdown
                label="자동수납"
                accent="teal"
                {...getDropdownProps("auto")}
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-[16px] lg:grid-cols-[minmax(240px,322px)_minmax(0,1fr)]">
        <BuildingUnitRail
          buildings={orgBuildings}
          units={units}
          receiptRows={receiptRows}
          isBuildingsLoading={!isHydrated || buildingsQuery.isLoading}
          isUnitsLoading={isUnitsLoading}
          canEdit={canEditPayment}
          view={railView}
          selectedBuildingId={selectedBuildingId}
          selectedUnitId={selectedUnitId}
          onSelectBuilding={selectBuilding}
          onSelectUnit={setSelectedUnitId}
          onBack={backToBuildings}
        />

        <div className="flex min-h-0 min-w-0 flex-col gap-[12px] overflow-auto">
          <PaymentHistorySection
            key={`pay-${selectedUnitId ?? "none"}`}
            orgId={orgId}
            buildingId={selectedBuildingId}
            buildingName={selectedBuilding?.name ?? selectedSummary?.buildingName ?? ""}
            buildingAddress={selectedBuilding?.address ?? null}
            hasUnit={selectedUnitId !== null}
            isLoading={isPaymentHistoryLoading}
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
            maskReadOnlyPhone
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
