"use client";

import { useMemo, useRef, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { EmptyState, Spinner } from "@/components/common";
import type { MovingSettlementValues } from "@/components/forms/schema/movingSettlement";
import { useBuildings, type Building } from "@/hooks/reactquery/buildings";
import { useMe } from "@/hooks/reactquery/auth";
import { useBillOrganizationName } from "@/hooks/reactquery/bill";
import {
  calculateSettlementAmount,
  settlementEtcItemsOf,
  useSettlementContext,
  type SaveSettlementInput,
  type SettlementContext,
  type SettlementUtilRow,
} from "@/hooks/reactquery/movingSettlement";
import { useManagementFeeRows } from "@/hooks/reactquery/movingSettlement/feeItemCharges";
import { useSettlementCheckItems } from "@/hooks/reactquery/settlementCheckItems";
import { useUnits } from "@/hooks/reactquery/units";
import { MeterInfoPanel } from "./MeterInfoPanel";
import { SettlementActions } from "./SettlementActions";
import { SettlementDirectoryRail } from "./SettlementDirectoryRail";
import { SettlementEmptyPanel } from "./SettlementEmptyPanel";
import { SettlementForm } from "./SettlementForm";
import { SettlementHistory } from "./SettlementHistory";
import {
  emptyStatementPrintModel,
  printSettlementStatement,
  type SettlementStatementPrintModel,
} from "./movingSettlementPrint";
import { UTILITY_ROWS, defaultUnitPrice } from "./settlement-form/UtilitySettlementSection";

/**
 * 이사 지침 기본값(정본 = extra.util, 0266).
 * - 저장된 extra.util 이 있으면 그 전월·이사 지침·단가(staff·partner 공통). 저장 단가가 비어 있으면 검침 단가 기본값.
 * - 없으면 전월 지침은 검침에서 채운다: 퇴실월 검침이면 그 달 previous_reading, 이전 달 검침이면 그 current_reading.
 *   단가는 검침 단가 기본값(수도·전기, 단가 반영 ON)으로 채우고 직원이 고칠 수 있다(2026-10-11).
 *   이사 지침은 현장에서 읽은 값을 입력한다(빈 값이면 금액을 계산하지 않고 저장 금액을 유지).
 */
function readingsFromContext(
  context: SettlementContext,
  saved: SettlementContext["latestSettlement"],
): Partial<MovingSettlementValues> {
  const savedUtil = saved?.extra?.util;
  const moveOutPeriod = saved?.moveOutDate ? `${saved.moveOutDate.slice(0, 7)}-01` : null;
  const next: Partial<MovingSettlementValues> = {};
  for (const row of UTILITY_ROWS) {
    const util = savedUtil?.find((item) => item.k === row.utility);
    if (util) {
      next[row.prevKey] = util.prev ?? null;
      next[row.moveKey] = util.cur ?? null;
      next[row.priceKey] =
        util.price ?? defaultUnitPrice(row.utility, context.meterSummary, context.settlementSettings);
      continue;
    }
    const meter = context.meterSummary.find((item) => item.utility === row.utility);
    next[row.prevKey] =
      meter && meter.period !== null && meter.period === moveOutPeriod
        ? meter.previousReading
        : (meter?.currentReading ?? meter?.previousReading ?? null);
    next[row.moveKey] = null;
    next[row.priceKey] = defaultUnitPrice(row.utility, context.meterSummary, context.settlementSettings);
  }
  return next;
}

function draftFromContext(
  context: SettlementContext,
  forceNew = false,
): MovingSettlementValues {
  // 마이그 0165 로 get_settlement_context 가 p_settlement_id 를 받는다.
  // 선택 건을 지정해 조회하므로 latestSettlement 가 곧 화면에 열린 그 정산이다.
  const saved = forceNew ? null : context.latestSettlement;

  return {
    moveOutDate: saved?.moveOutDate ?? "",
    mgmtFeeMonthly: saved?.mgmtFeeMonthly ?? null,
    mgmtFeeProrated: saved?.mgmtFeeProrated ?? null,
    waterCharge: saved?.waterCharge ?? null,
    elecCharge: saved?.elecCharge ?? null,
    gasCharge: saved?.gasCharge ?? null,
    elecPaidDate: saved?.elecPaidDate ?? "",
    gasPaidDate: saved?.gasPaidDate ?? "",
    repairAttribution: saved?.repairAttribution ?? null,
    // 0302: 기타 목록(extra.etcItems). 이전 저장 건(단일 repair_memo/repair_amount)은 1행으로 연다.
    etcItems: settlementEtcItemsOf(saved),
    // 청소금액 = cleaning_cost(전체 이사조회 청소비 인라인 편집과 같은 값), 나머지는 extra.cleaning.
    cleaningBy: saved?.extra?.cleaning?.by ?? "",
    cleaningStatus: saved?.extra?.cleaning?.status === "완료" ? "완료" : "미결",
    cleaningDoneDate: saved?.extra?.cleaning?.doneDate ?? "",
    cleaningCost: saved?.cleaningCost ?? null,
    cleaningAcct: saved?.extra?.cleaning?.acct ?? "",
    cleaningNote: saved?.extra?.cleaning?.note ?? "",
    advance: savedNumber(saved?.extra?.adv),
    settleBank: saved?.settleBank ?? context.settleAccount.settleBank ?? "",
    settleAcct: saved?.settleAcct ?? context.settleAccount.settleAcct ?? "",
    settleHolder:
      saved?.settleHolder ?? context.settleAccount.settleHolder ?? "",
    note: saved?.note ?? "",
    settlementNote:
      saved?.settlementNote ?? context.occupancy?.settlementNote ?? "",
    ...readingsFromContext(context, saved),
  };
}

/** extra 의 숫자 값(수납액·가수금). 0·빈 값은 null. */
function savedNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

function nullableText(value: string | undefined): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

type RailView = "bld" | "unit" | "set";
// 정본 setView 의 단계 D={bld:0,unit:1,set:2}. 더 얕은 단계로 가면 isBack(.back).
const RAIL_DEPTH: Record<RailView, number> = { bld: 0, unit: 1, set: 2 };

function railViewOf(buildingId: number | null, unitId: number | null): RailView {
  if (unitId !== null) return "set";
  return buildingId !== null ? "unit" : "bld";
}

function SettlementEditor({
  building,
  context,
  occupancy,
  forceNew,
  onDeleted,
}: {
  building: Building;
  context: SettlementContext;
  occupancy: NonNullable<SettlementContext["occupancy"]>;
  forceNew: boolean;
  onDeleted: () => void;
}) {
  const [draft, setDraft] = useState(() => draftFromContext(context, forceNew));
  // 정산 체크는 항목별 메모가 본문이고 checked 는 "메모가 비어있지 않음" 으로 파생된다(0172).
  // note 가 없는데 checked 인 행(모바일 체크박스로만 켠 경우)은 기존 표시대로 '확인' 으로 읽는다.
  const [notes, setNotes] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      context.checklist.map((item) => [
        item.id,
        item.note ?? (item.checked ? "확인" : ""),
      ]),
    ),
  );
  // 수납액·최종 수납일(extra.paid·lastPaidDate, 0302): 저장된 값으로 시작하고, 저장 전에는 이 화면에서 고친 값이 우선한다.
  // 미수금 가드(SettlementActions)도 이 값으로 계산한다.
  const savedExtra = forceNew ? null : (context.latestSettlement?.extra ?? null);
  const [receivedAmount, setReceivedAmount] = useState(
    () => savedNumber(savedExtra?.paid) ?? 0,
  );
  const [finalPaidDate, setFinalPaidDate] = useState(
    () => savedExtra?.lastPaidDate ?? "",
  );
  const [activeSettlementId, setActiveSettlementId] = useState<number | null>(
    forceNew ? null : (context.latestSettlement?.id ?? null),
  );
  const paymentInputRef = useRef<HTMLInputElement>(null);
  const formBodyRef = useRef<HTMLDivElement>(null);
  const { data: me } = useMe();
  const { data: organizationName } = useBillOrganizationName(me?.orgId);
  const managementFeeRows = useManagementFeeRows(
    building.typeId,
    context.unit.id,
    draft.moveOutDate,
  );

  // 내역서 검침표도 폼과 같은 이사 지침(전월·이사·단가)과 draft 금액을 쓴다(0266).
  const meterRows: SettlementStatementPrintModel["meters"] = UTILITY_ROWS.map((row) => {
    const prev = draft[row.prevKey] ?? null;
    const cur = draft[row.moveKey] ?? null;
    return {
      utility: row.utility,
      previousReading: prev,
      currentReading: cur,
      usage: prev !== null && cur !== null ? Math.max(0, cur - prev) : null,
      unitPrice: draft[row.priceKey] ?? null,
      charge: draft[row.chargeKey] ?? null,
    };
  });
  const utilityTotal = meterRows.reduce(
    (sum, meter) => sum + (meter.charge ?? 0),
    0,
  );
  const managementMonthlyTotal = managementFeeRows.rows.reduce(
    (sum, row) => sum + row.charge,
    0,
  );
  // ② 관리비 소계 = 정산액 합 + 가수금(현장 관리자 정책 3.3 · partner _ms.ts computeTotals s2 와 같은 정의).
  // draft.mgmtFeeProrated 는 정산액 합(관리비 항목 일할)만 들고, 저장하는 mgmt_fee_prorated 에는 가수금을 더한다.
  const advance = draft.advance ?? 0;
  const managementSettlementTotal =
    managementFeeRows.rows.reduce((sum, row) => sum + row.settlement, 0) + advance;
  const mgmtFeeSubtotal =
    draft.mgmtFeeProrated === null && advance === 0
      ? null
      : (draft.mgmtFeeProrated ?? 0) + advance;
  // ③ 기타 소계 = 기타 항목 금액 합계(서버 settlement_etc_total 과 같은 값, 0302).
  const etcTotal = draft.etcItems.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const savedEtcItems = draft.etcItems
    .map((item) => ({ name: item.name.trim(), amount: item.amount ?? 0 }))
    .filter((item) => item.name !== "" || item.amount !== 0);
  const repairAmount = savedEtcItems.length > 0 ? etcTotal : null;
  const repairMemo = savedEtcItems.map((item) => item.name).filter(Boolean).join(", ");
  const cleaningCost = draft.cleaningCost ?? null;
  const billingUnpaid = context.billingUnpaid;
  // 정산요금 = settlement_amount 정의(0266): 수납 차감 전 ①공과금+②관리비+③미납+④청소비·기타.
  const total =
    utilityTotal +
    managementSettlementTotal +
    (repairAmount ?? 0) +
    billingUnpaid +
    (cleaningCost ?? 0);
  // 저장할 이사 지침(extra.util). 화면에 없는 입금계좌·입금일(수도)은 저장된 값을 지킨다.
  const savedUtil = forceNew ? undefined : context.latestSettlement?.extra?.util;
  const utilRows: SettlementUtilRow[] = UTILITY_ROWS.map((row) => {
    const saved = savedUtil?.find((item) => item.k === row.utility);
    return {
      k: row.utility,
      prev: draft[row.prevKey] ?? null,
      cur: draft[row.moveKey] ?? null,
      price: draft[row.priceKey] ?? null,
      acct: saved?.acct || draft.settleAcct || "",
      payDate: row.paidDateKey ? (draft[row.paidDateKey] ?? "") : (saved?.payDate ?? ""),
    };
  });
  // 이사 지침(cur)을 하나도 입력하지 않은 건(예전 금액만 저장한 건)은 util 을 보내지 않아 extra 를 그대로 둔다.
  // 전월 지침(prev)은 검침에서, 단가(price)는 단가 반영 ON 이면 검침 단가로 자동으로 채워지므로 기준에서 뺀다 —
  // 자동값만으로 util 을 쓰면 파트너 저장(_ms.ts)이 레거시가 아닌 건으로 보고 금액을 비울 수 있다.
  // 단가를 검침 기본값과 다르게 고친 경우도 저장해야 하므로(그 달 단가 변경, 2026-10-11) 함께 기준에 넣는다.
  const sendUtil =
    savedUtil !== undefined
    || utilRows.some((row) => row.cur !== null)
    || UTILITY_ROWS.some((row, index) =>
      utilRows[index].price !== defaultUnitPrice(row.utility, context.meterSummary, context.settlementSettings));
  // 정본 표기: `농협 352-1234-5678-91 · (주)스마일종합관리` — 은행·계좌는 공백, 예금주 앞만 구분점.
  const settleAccount = [
    [draft.settleBank, draft.settleAcct]
      .map((value) => value?.trim() ?? "")
      .filter(Boolean)
      .join(" "),
    draft.settleHolder?.trim() ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  const printModel: SettlementStatementPrintModel = {
    moveOutDate: draft.moveOutDate,
    buildingName: context.unit.buildingName,
    unitNo: context.unit.unitNo,
    ownerPhone: building.ownerPhone,
    address: building.address,
    occupantPhone: occupancy.phone,
    meters: meterRows,
    chargeDays: draft.moveOutDate
      ? Number(draft.moveOutDate.slice(8, 10)) || 0
      : null,
    monthDays: draft.moveOutDate ? 30 : null,
    utilityTotal,
    managementRows: [
      ...managementFeeRows.rows.map((row) => ({
        name: row.item.name,
        charge: row.charge,
        settlement: row.settlement,
      })),
      // partner 내역서처럼 가수금이 있으면 한 줄로 보인다(② 합계에 포함).
      ...(advance !== 0 ? [{ name: "가수금", charge: 0, settlement: advance }] : []),
    ],
    managementMonthlyTotal,
    managementSettlementTotal,
    etcItems: savedEtcItems,
    repairAmount,
    billingUnpaid,
    cleaningCost,
    total,
    settleAccount: settleAccount || null,
    note: draft.note || null,
    checklist: context.checklist.map((item) => ({
      label: item.label,
      note: item.note,
    })),
    organizationName: organizationName ?? null,
  };

  const saveInput: SaveSettlementInput = {
    unitId: context.unit.id,
    occupancyId: occupancy.id,
    settlementId: activeSettlementId,
    data: {
      moveOutDate: draft.moveOutDate,
      mgmtFeeMonthly: draft.mgmtFeeMonthly,
      mgmtFeeProrated: mgmtFeeSubtotal,
      waterCharge: draft.waterCharge,
      elecCharge: draft.elecCharge,
      gasCharge: draft.gasCharge,
      cleaningCost,
      elecPaidDate: nullableText(draft.elecPaidDate),
      gasPaidDate: nullableText(draft.gasPaidDate),
      repairAmount,
      repairAttribution: draft.repairAttribution,
      repairMemo: nullableText(repairMemo),
      settleBank: nullableText(draft.settleBank),
      settleAcct: nullableText(draft.settleAcct),
      settleHolder: nullableText(draft.settleHolder),
      note: nullableText(draft.note),
      settlementNote: nullableText(draft.settlementNote),
      ...(sendUtil ? { util: utilRows } : {}),
      // 0302: partner(_ms.ts)와 같은 extra 키. 서버가 기존 extra 에 병합한다.
      extra: {
        etcItems: savedEtcItems,
        cleaning: {
          by: draft.cleaningBy?.trim() ?? "",
          status: draft.cleaningStatus,
          doneDate: draft.cleaningDoneDate ?? "",
          acct: draft.cleaningAcct?.trim() ?? "",
          note: draft.cleaningNote?.trim() ?? "",
        },
        paid: receivedAmount,
        lastPaidDate: finalPaidDate,
        adv: draft.advance ?? 0,
      },
    },
    checklist: context.checklist.map((item) => {
      const note = (notes[item.id] ?? "").trim();
      return { checkItemId: item.id, checked: note !== "", note };
    }),
  };

  const amount = calculateSettlementAmount({
    ...draft,
    mgmtFeeProrated: mgmtFeeSubtotal,
    repairAmount,
    cleaningCost,
    unpaidAmount: billingUnpaid,
  });
  const settlementStatus = forceNew ? null : (context.latestSettlement?.status ?? null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[12px]">
      <SettlementForm
        buildingName={building.name}
        buildingTypeId={building.typeId}
        unitId={context.unit.id}
        unitNo={context.unit.unitNo}
        contactPhone={occupancy.phone ?? ""}
        value={draft}
        onChange={setDraft}
        meters={context.meterSummary}
        settings={context.settlementSettings}
        checklist={context.checklist}
        notes={notes}
        onChecklistNoteChange={(id, next) =>
          setNotes((current) => ({ ...current, [id]: next }))
        }
        receivedAmount={receivedAmount}
        onReceivedAmountChange={setReceivedAmount}
        finalPaidDate={finalPaidDate}
        onFinalPaidDateChange={setFinalPaidDate}
        paymentInputRef={paymentInputRef}
        bodyRef={formBodyRef}
        billingUnpaid={context.billingUnpaid}
      />
      <SettlementActions
        building={building}
        unit={context.unit}
        draft={draft}
        input={saveInput}
        settlementId={activeSettlementId}
        amount={amount}
        receivedAmount={receivedAmount}
        billingUnpaid={context.billingUnpaid}
        vacancyPaymentMode={context.settlementSettings.vacancyPaymentMode}
        createdAt={context.latestSettlement?.createdAt ?? null}
        locked={settlementStatus === "completed" || settlementStatus === "mid_moveout"}
        completedLocked={settlementStatus === "completed"}
        printModel={printModel}
        paymentInputRef={paymentInputRef}
        formBodyRef={formBodyRef}
        onSaved={setActiveSettlementId}
        onDeleted={() => {
          setActiveSettlementId(null);
          onDeleted();
        }}
      />
    </div>
  );
}

export function MovingSettlementWorkspace() {
  const buildingsQuery = useBuildings();
  const { data: workspaceMe } = useMe();
  const { data: workspaceOrganizationName } = useBillOrganizationName(workspaceMe?.orgId);
  const checkItemsQuery = useSettlementCheckItems();
  const [buildingId, setBuildingId] = useState<number | null>(null);
  const [unitId, setUnitId] = useState<number | null>(null);
  const [forceNew, setForceNew] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedSettlementId, setSelectedSettlementId] = useState<number | null>(
    null,
  );
  const [editorVersion, setEditorVersion] = useState(0);
  // 정본 setView 는 부를 때마다(같은 목록에 다시 와도) 들어오는 표의 slide 를 처음부터 재생하고,
  // 더 얕은 단계로 돌아가면 .back 으로 반대쪽에서 민다 → 전환 횟수와 방향을 레일에 내려준다.
  const [railMotion, setRailMotion] = useState({ seq: 0, back: false });
  const unitsQuery = useUnits(buildingId ?? 0);
  const contextQuery = useSettlementContext(unitId, selectedSettlementId);

  const buildings = useMemo(
    () => buildingsQuery.data ?? [],
    [buildingsQuery.data],
  );
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);
  const context = unitId === null ? undefined : contextQuery.data;
  const selectedBuilding =
    buildings.find((building) => building.id === buildingId) ?? null;
  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null;
  const isSettlementWorkspaceRefreshing =
    [buildingsQuery, unitsQuery].some((query) => query.isFetching && !query.isLoading) ||
    (editorOpen && contextQuery.isFetching && !contextQuery.isLoading);

  const moveRail = (nextBuildingId: number | null, nextUnitId: number | null) => {
    const back =
      RAIL_DEPTH[railViewOf(nextBuildingId, nextUnitId)] <
      RAIL_DEPTH[railViewOf(buildingId, unitId)];
    setRailMotion((current) => ({ seq: current.seq + 1, back }));
  };

  const selectBuilding = (value: string | number | null) => {
    const next = value === null || value === "" ? null : Number(value);
    moveRail(next, null);
    setBuildingId(next);
    setUnitId(null);
    setForceNew(false);
    setEditorOpen(false);
    setSelectedSettlementId(null);
  };

  const selectUnit = (value: string | number | null) => {
    const next = value === null || value === "" ? null : Number(value);
    moveRail(buildingId, next);
    setUnitId(next);
    setForceNew(false);
    setEditorOpen(false);
    setSelectedSettlementId(null);
  };

  const selectBuildingUnit = (nextBuildingId: number, nextUnitId: number) => {
    moveRail(nextBuildingId, nextUnitId);
    setBuildingId(nextBuildingId);
    setUnitId(nextUnitId);
    setForceNew(false);
    setEditorOpen(false);
    setSelectedSettlementId(null);
  };

  const startNewSettlement = () => {
    if (unitId === null) return;
    setSelectedSettlementId(null);
    setForceNew(true);
    setEditorOpen(true);
    setEditorVersion((current) => current + 1);
  };

  const emptyAction = () =>
    toast.info("건물과 호실을 먼저 선택해 주세요.");

  // 빈 양식은 정산 데이터가 필요 없으므로 건물·호실 선택 전에도 인쇄한다.
  // 점검 항목만 org 마스터에서 받아 항목명을 채운다.
  const printBlankStatement = () =>
    printSettlementStatement(
      emptyStatementPrintModel({
        checklistLabels: (checkItemsQuery.data ?? []).map((item) => item.label),
        organizationName: workspaceOrganizationName ?? null,
      }),
      { blank: true },
    );

  return (
    <div className="relative min-h-[calc(100dvh-62px)] overflow-x-auto bg-bg px-[24px] pb-[22px] pt-[18px]">
      {isSettlementWorkspaceRefreshing ? (
        <div className="absolute right-6 top-3 z-10 rounded-lg bg-white/95 shadow-card">
          <Spinner label="이사정산 자료 갱신 중" size="small" showLabel className="px-3 py-2" />
        </div>
      ) : null}
      <label className="sr-only">
        건물 선택
        <select
          aria-label="건물 선택"
          value={buildingId ?? ""}
          onChange={(event) => selectBuilding(event.target.value)}
        >
          <option value="">건물을 선택해 주세요</option>
          {buildings.map((building) => (
            <option key={building.id} value={building.id}>
              {building.name}
            </option>
          ))}
        </select>
      </label>
      <label className="sr-only">
        호실 선택
        <select
          aria-label="호실 선택"
          value={unitId ?? ""}
          onChange={(event) => selectUnit(event.target.value)}
        >
          <option value="">호실을 선택해 주세요</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {[unit.dong, unit.unitNo].filter(Boolean).join(" ")}
            </option>
          ))}
        </select>
      </label>

      <div className="mx-auto grid h-[calc(100dvh-102px)] min-h-[720px] min-w-[1340px] max-w-[1872px] grid-cols-[322px_322px_minmax(664px,1fr)] gap-[16px]">
        <SettlementDirectoryRail
          buildings={buildings}
          units={units}
          buildingId={buildingId}
          unitId={unitId}
          buildingsLoading={buildingsQuery.isLoading}
          unitsLoading={unitsQuery.isLoading}
          selectedSettlementId={selectedSettlementId}
          settlementNote={context?.occupancy?.settlementNote ?? null}
          viewSeq={railMotion.seq}
          viewBack={railMotion.back}
          onSelectBuilding={(id) => selectBuilding(id)}
          onSelectUnit={(id) => selectUnit(id)}
          onStartNew={startNewSettlement}
          onSelectSettlement={(id) => {
            setSelectedSettlementId(id);
            setForceNew(false);
            setEditorOpen(true);
          }}
        />

        <div className="flex min-h-0 flex-col gap-[16px] overflow-hidden">
          <SettlementHistory
            selectedBuildingId={buildingId}
            selectedUnitId={unitId}
            onSelect={selectBuildingUnit}
          />
          <MeterInfoPanel
            unitId={unitId}
            selected={Boolean(context?.occupancy)}
          />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col">
          {unitId === null && (
            <SettlementEmptyPanel onAction={emptyAction} onBlankPrint={printBlankStatement} />
          )}
          {unitId !== null && !editorOpen && (
            <SettlementEmptyPanel
              onAction={emptyAction}
              onBlankPrint={printBlankStatement}
              title="정산된 이사 항목을 선택해 주세요"
              description={
                <>
                  좌측 목록에서 항목을 고르거나
                  <br />
                  새 이사정산 입력을 눌러 작성해요
                </>
              }
            />
          )}
          {editorOpen && contextQuery.isLoading && (
            <div className="grid min-h-[420px] flex-1 place-items-center rounded-[16px] bg-white shadow-card">
              <Spinner label="이사정산 정보 불러오는 중" />
            </div>
          )}
          {editorOpen && contextQuery.error && (
            <div role="alert" className="grid min-h-[420px] flex-1 place-items-center rounded-[16px] bg-white shadow-card">
              <EmptyState message="정산 정보를 불러오지 못했어요" />
            </div>
          )}
          {editorOpen && context && context.occupancy === null && (
            <div className="grid min-h-0 flex-1 place-items-center rounded-[16px] bg-white shadow-card">
              <EmptyState message="선택한 호실에 입주 정보가 없어요" />
            </div>
          )}
          {editorOpen && context && context.occupancy && selectedBuilding && selectedUnit && (
            <SettlementEditor
              key={`${context.unit.id}:${forceNew ? `new-${editorVersion}` : (selectedSettlementId ?? "new")}`}
              building={selectedBuilding}
              context={context}
              occupancy={context.occupancy}
              forceNew={forceNew}
              onDeleted={() => {
                setSelectedSettlementId(null);
                setForceNew(true);
                setEditorVersion((current) => current + 1);
              }}
            />
          )}
        </div>
      </div>

    </div>
  );
}
