import { formatWon } from "@/lib/format";
import { roundCharge, type Rounding } from "@/lib/billing/proration";

// 현장 파트너 모바일 이사정산 폼의 상태 모델 · 계산 · 저장 매핑.
// 표준 컬럼으로 표현되지 않는 부가 항목(단가·입금계좌·관리비 항목별 내역·가수금·기타 항목·
// 청소 상세·수납액·계산일수)은 moving_settlements.extra(jsonb)에 함께 보관한다.

export type Utility = "water" | "elec" | "gas";

export const UTILITY_LABEL: Record<Utility, string> = {
  water: "수도",
  elec: "전기",
  gas: "가스",
};

export type UtilRow = {
  k: Utility;
  prev: number;
  cur: number;
  price: number;
  acct: string;
  payDate: string; // YYYY-MM-DD
};

/** rounding: 관리비 항목 반올림 설정(계산 규칙 1.2). 예전 저장분·기본 목록엔 없어서 없으면 원 단위 반올림. */
export type FeeItem = { name: string; daily: boolean; charged: number; rounding?: Rounding };
export type EtcItem = { name: string; amount: number };
export type CleaningStatus = "미결" | "완료";

export type MSState = {
  moveOutDate: string;
  dTotal: number;
  dDays: number;
  util: UtilRow[];
  feeItems: FeeItem[];
  adv: number;
  advTel: string;
  etcItems: EtcItem[];
  clnBy: string;
  clnStatus: CleaningStatus;
  clnDone: string;
  clnAmt: number;
  clnAcct: string;
  clnNote: string;
  paid: number;
  lastPaidDate: string;
  memo: string;
  /** 정산 체크 항목별 메모(0172). 저장할 때 checked = 메모가 비어 있지 않음(사무실 화면과 같은 규칙). */
  notes: Record<number, string>;
};

export type PartnerMeter = {
  utility: Utility;
  /** 검침월(YYYY-MM-01). 퇴실월 검침인지 판단해 「전월 지침」을 고른다(0285). */
  period: string | null;
  previousReading: number | null;
  currentReading: number | null;
  /** 그 달 검침 단가. 아직 계산 전이면 null. */
  unitPrice: number | null;
  usage: number | null;
};

export type PartnerChecklistItem = { id: number; label: string; checked: boolean; note: string | null };

export type PartnerSettlement = {
  id: number;
  status: string;
  moveOutDate: string | null;
  note: string | null;
  cleaningCost: number | null;
  waterCharge: number | null;
  elecCharge: number | null;
  gasCharge: number | null;
  elecPaidDate: string | null;
  gasPaidDate: string | null;
  /** 기타 소계·항목명(0302 이전 사무실 저장 건은 extra.etcItems 없이 이 두 값만 있다). */
  repairAmount: number | null;
  repairMemo: string | null;
  extra: MSExtra | null;
};

export type PartnerSettlementContext = {
  unit: {
    id: number;
    unitNo: string;
    dong: string | null;
    buildingId: number;
    buildingName: string;
  };
  occupancy: {
    id: number;
    tenantName: string | null;
    phone: string | null;
    moveInDate: string | null;
    settlementNote: string | null;
    status: string;
  } | null;
  latestSettlement: PartnerSettlement | null;
  settleAccount: {
    settleBank: string | null;
    settleAcct: string | null;
    settleHolder: string | null;
  };
  checklist: PartnerChecklistItem[];
  meterSummary: PartnerMeter[];
  /**
   * ③ 미납 = 현재 occupancy 의 확정 부과 미납관리비 + 연체료(서버 settlement_billing_unpaid, 0268).
   * 저장 RPC 가 같은 occupancy 로 계산해 settlement_amount 에 더하므로 화면 미수금도 이 값을 포함한다.
   */
  billingUnpaid: number;
};

export type MSExtra = {
  dTotal?: number;
  dDays?: number;
  util?: { k: Utility; prev: number; cur: number; price: number; acct: string; payDate: string }[];
  feeItems?: FeeItem[];
  adv?: number;
  advTel?: string;
  etcItems?: EtcItem[];
  cleaning?: { by?: string; status?: CleaningStatus; doneDate?: string; acct?: string; note?: string };
  paid?: number;
  lastPaidDate?: string;
};

export const DEFAULT_FEE_ITEMS: FeeItem[] = [
  { name: "일반관리비", daily: true, charged: 0 },
  { name: "청소비", daily: true, charged: 0 },
  { name: "승강기유지비", daily: false, charged: 0 },
  { name: "수선유지비", daily: false, charged: 0 },
  { name: "화재보험료", daily: false, charged: 0 },
];

export const MAX_ETC_ITEMS = 15;

// ===== 숫자/통화 =====
// 금액 입력은 0 이상만 받는다(정본 n0 와 같이 숫자 외 문자 — '-' 포함 — 를 모두 제거, 개선3차 35).
export function toNumber(value: unknown): number {
  const n = Number(String(value ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function won(n: number): string {
  return `${n < 0 ? "-" : ""}${formatWon(Math.abs(n))}`;
}

// ===== 계산 =====
export function utilAmount(u: UtilRow): number {
  const usage = Math.max(0, (u.cur || 0) - (u.prev || 0));
  return Math.round(usage * (u.price || 0));
}

/**
 * 이사 지침을 넣었는데 전월 지침보다 작음(역전). 누적 계량기라 정상이면 생기지 않는다 — 검침 오기·계량기 교체·한 바퀴.
 * 사용량은 0으로 계산하되(음수 요금 방지) 화면에서 경고한다. 저장은 막지 않는다(계산 규칙 6절 ②).
 */
export function isReadingReversed(u: UtilRow): boolean {
  return (u.cur || 0) > 0 && (u.cur || 0) < (u.prev || 0);
}

export function utilUsage(u: UtilRow): number {
  return Math.max(0, (u.cur || 0) - (u.prev || 0));
}

/**
 * 계산일수 · 부과 기본값 = 퇴실 달의 실거주 일수(퇴실일의 '일'). 계산 규칙 1.1·6절,
 * 사무실 이사정산 화면과 같은 값. 퇴실일이 없으면 0.
 */
export function chargeDaysFromMoveOut(moveOutDate: string | null | undefined): number {
  return Number(moveOutDate?.slice(8, 10)) || 0;
}

export function feeProrated(f: FeeItem, dTotal: number, dDays: number): number {
  if (f.daily && dTotal > 0) return roundCharge((f.charged || 0) * dDays / dTotal, f.rounding ?? "raw");
  return f.charged || 0;
}

export type MSTotals = {
  s1: number; // 공과금 소계
  s2: number; // 관리비 소계 (관리비 정산 + 가수금)
  s3: number; // 기타 소계
  cleaning: number;
  billingUnpaid: number; // 미납 관리비(연체료 포함, 서버 ③)
  unpaidSubtotal: number; // 미납 소계 = 서버 settlement_amount(수납 차감 전)
  balance: number; // 미수금 = 미납 소계 − 수납액
};

/**
 * 저장 시 쓰는 공과금 금액. 단가·이사 지침이 비어 있으면 0(null)이다 — 지운 지침의 이전 금액이 남지 않게 한다.
 * 지침 없이 금액만 저장된 구분(legacyCharge, 사무실 예전 저장분)만 그 금액을 유지한다.
 */
function utilCharge(u: UtilRow | undefined, legacyCharge: number | null | undefined): number | null {
  if (!u) return null;
  if (!u.price || !u.cur) return legacyCharge ?? null;
  return nullableInt(utilAmount(u));
}

/**
 * 지침 없이 금액만 저장된 구분의 저장 금액. 저장된 extra.util 에 그 구분의 이사 지침(cur > 0)이 있으면
 * 금액은 지침에서 나온 값이므로 null(서버 settlement_util_row · 사무실 legacyUtilityCharges 와 같은 기준).
 */
function savedUtilCharge(k: Utility, saved: PartnerSettlement | null): number | null {
  if (!saved) return null;
  const savedRow = saved.extra?.util?.find((r) => r.k === k);
  if (savedRow && (savedRow.cur || 0) > 0) return null;
  return k === "water" ? saved.waterCharge : k === "elec" ? saved.elecCharge : saved.gasCharge;
}

/**
 * 합계·미수금. 저장 RPC(partner_save_moving_settlement)의 settlement_amount 와 같은 식이다:
 * ①공과금(저장 매핑과 같은 금액) + ②관리비 + 기타 + 청소 + 미납 관리비(③, 서버 값) − 수납액.
 * ctx 는 저장에 쓰는 컨텍스트(신규 등록이면 latestSettlement 없음)를 넘긴다.
 */
export function computeTotals(
  state: MSState,
  ctx: Pick<PartnerSettlementContext, "latestSettlement" | "billingUnpaid">,
): MSTotals {
  const s1 = state.util.reduce(
    (t, u) => t + (utilCharge(u, savedUtilCharge(u.k, ctx.latestSettlement)) ?? 0),
    0,
  );
  const feeSum = state.feeItems.reduce(
    (t, f) => t + feeProrated(f, state.dTotal, state.dDays),
    0,
  );
  const s2 = feeSum + (state.adv || 0);
  const s3 = state.etcItems.reduce((t, x) => t + (x.amount || 0), 0);
  const cleaning = state.clnAmt || 0;
  const billingUnpaid = ctx.billingUnpaid || 0;
  const unpaidSubtotal = s1 + s2 + s3 + cleaning + billingUnpaid;
  const balance = unpaidSubtotal - (state.paid || 0);
  return { s1, s2, s3, cleaning, billingUnpaid, unpaidSubtotal, balance };
}

// ===== 초기 상태 =====
/**
 * 셋업 「이사정산 입금 계좌」 표시 문자열: "은행 계좌번호 예금주"(공백으로만 구분, 내역서 정산금 입금계좌와 같은 형식).
 * 비어 있는 값은 빼고, 셋 다 없으면 빈 문자열.
 */
export function formatSettleAccount(account: {
  settleBank: string | null;
  settleAcct: string | null;
  settleHolder: string | null;
}): string {
  return [account.settleBank, account.settleAcct, account.settleHolder]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

/** 셋업 정책 3.3 「단가 반영」 고정(수도·전기=반영). 가스는 외부 검침이라 단가를 직접 입력한다. */
const UNIT_PRICE_REFLECTED: ReadonlySet<Utility> = new Set<Utility>(["water", "elec"]);

/**
 * 공과금 정산 행 기본값 — 사무실 이사정산(readingsFromContext, 0266)과 같은 규칙.
 * - 전월 지침: 퇴실월 검침이면 그 달 previous_reading, 이전 달 검침이면 그 current_reading.
 * - 이사 지침: 현장에서 읽은 값을 입력한다(비워 둠).
 * - 단가: 수도·전기는 그 달 검침 단가(없으면 직접 입력), 가스는 직접 입력.
 * - 입금계좌: 셋업 「이사정산 입금 계좌」(은행 계좌번호 예금주). 입금일은 실제 입금한 날이라 직접 입력한다.
 * 저장된 행이 있으면 저장값을 쓰되, 비어 있는 단가·입금계좌만 위 기본값으로 채운다.
 */
function seededUtil(
  meters: PartnerMeter[],
  saved: MSExtra["util"] | undefined,
  moveOutDate: string | null | undefined,
  settleAccount: PartnerSettlementContext["settleAccount"],
): UtilRow[] {
  // 정본 카드 순서: 전기 · 수도 · 가스
  const order: Utility[] = ["elec", "water", "gas"];
  const moveOutPeriod = moveOutDate ? `${moveOutDate.slice(0, 7)}-01` : null;
  const defaultAcct = formatSettleAccount(settleAccount);
  return order.map((k) => {
    const meter = meters.find((m) => m.utility === k);
    const meterPrice = UNIT_PRICE_REFLECTED.has(k) ? (meter?.unitPrice ?? 0) : 0;
    const savedRow = saved?.find((r) => r.k === k);
    if (savedRow) {
      return {
        k,
        prev: savedRow.prev ?? 0,
        cur: savedRow.cur ?? 0,
        price: savedRow.price || meterPrice,
        acct: savedRow.acct || defaultAcct,
        payDate: savedRow.payDate ?? "",
      };
    }
    const prev =
      meter && meter.period !== null && meter.period === moveOutPeriod
        ? meter.previousReading
        : (meter?.currentReading ?? meter?.previousReading ?? null);
    return {
      k,
      prev: prev ?? 0,
      cur: 0,
      price: meterPrice,
      acct: defaultAcct,
      payDate: "",
    };
  });
}

export function initialState(ctx: PartnerSettlementContext): MSState {
  const saved = ctx.latestSettlement;
  const extra = saved?.extra ?? null;
  // 메모 없이 체크만 켜진 항목(예전 모바일 체크박스로 저장한 건)은 사무실 화면처럼 '확인'으로 읽는다.
  const notes: Record<number, string> = {};
  for (const item of ctx.checklist) notes[item.id] = item.note ?? (item.checked ? "확인" : "");

  const util = seededUtil(ctx.meterSummary, extra?.util, saved?.moveOutDate, ctx.settleAccount);
  // 저장된 정산의 입금일이 있으면 util 행에 반영(extra가 없던 레거시 대비).
  if (saved && !extra?.util) {
    const elec = util.find((u) => u.k === "elec");
    const gas = util.find((u) => u.k === "gas");
    if (elec && saved.elecPaidDate) elec.payDate = saved.elecPaidDate;
    if (gas && saved.gasPaidDate) gas.payDate = saved.gasPaidDate;
  }

  return {
    moveOutDate: saved?.moveOutDate ?? "",
    dTotal: extra?.dTotal ?? 30,
    // 저장값이 없거나 0이면(예전 저장분 포함) 퇴실일 기준 실거주 일수로 채운다. 화면에서 직접 고칠 수 있다.
    dDays: extra?.dDays || chargeDaysFromMoveOut(saved?.moveOutDate),
    util,
    feeItems:
      extra?.feeItems && extra.feeItems.length > 0
        ? extra.feeItems.map((f) => ({
            name: f.name,
            daily: !!f.daily,
            charged: f.charged || 0,
            ...(f.rounding ? { rounding: f.rounding } : {}),
          }))
        : DEFAULT_FEE_ITEMS.map((f) => ({ ...f })),
    adv: extra?.adv ?? 0,
    advTel: extra?.advTel ?? "",
    etcItems:
      extra?.etcItems && extra.etcItems.length > 0
        ? extra.etcItems.map((x) => ({ name: x.name, amount: x.amount || 0 }))
        : // 기타 목록이 없는 예전 사무실 저장 건은 단일 기타(repair_memo/repair_amount)를 1행으로 연다 — 비워 두면 저장 때 기타가 사라진다.
          saved && (saved.repairMemo || saved.repairAmount)
          ? [{ name: saved.repairMemo ?? "", amount: saved.repairAmount || 0 }]
          : [{ name: "", amount: 0 }],
    clnBy: extra?.cleaning?.by ?? "",
    clnStatus: extra?.cleaning?.status ?? "미결",
    clnDone: extra?.cleaning?.doneDate ?? "",
    clnAmt: saved?.cleaningCost ?? 0,
    clnAcct: extra?.cleaning?.acct ?? "",
    clnNote: extra?.cleaning?.note ?? "",
    paid: extra?.paid ?? 0,
    lastPaidDate: extra?.lastPaidDate ?? "",
    memo: saved?.note ?? "",
    notes,
  };
}

// ===== 저장 매핑 =====
function nullableInt(n: number): number | null {
  return n ? n : null;
}
function nullableText(v: string): string | null {
  const t = v.trim();
  return t !== "" ? t : null;
}

export function buildSaveData(
  state: MSState,
  ctx: PartnerSettlementContext,
): Record<string, unknown> {
  const totals = computeTotals(state, ctx);
  const water = state.util.find((u) => u.k === "water");
  const elec = state.util.find((u) => u.k === "elec");
  const gas = state.util.find((u) => u.k === "gas");
  const etcNames = state.etcItems
    .map((x) => x.name.trim())
    .filter((n) => n !== "")
    .join(", ");

  const extra: MSExtra = {
    dTotal: state.dTotal,
    dDays: state.dDays,
    util: state.util.map((u) => ({
      k: u.k,
      prev: u.prev,
      cur: u.cur,
      price: u.price,
      acct: u.acct,
      payDate: u.payDate,
    })),
    feeItems: state.feeItems,
    adv: state.adv,
    advTel: state.advTel,
    etcItems: state.etcItems.filter((x) => x.name.trim() !== "" || x.amount),
    cleaning: {
      by: state.clnBy,
      status: state.clnStatus,
      doneDate: state.clnDone,
      acct: state.clnAcct,
      note: state.clnNote,
    },
    paid: state.paid,
    lastPaidDate: state.lastPaidDate,
  };

  // 단가 또는 이사 지침이 비어 있는 행은 금액 0(null)으로 저장한다. 지침 없이 금액만 저장된 구분(사무실 예전
  // 저장분)만 그 금액을 유지한다(savedUtilCharge). 금액 = max(0, 이사−전월) × 단가(0266).
  const saved = ctx.latestSettlement;

  return {
    move_out_date: state.moveOutDate,
    mgmt_fee_monthly: nullableInt(state.feeItems.reduce((t, f) => t + (f.charged || 0), 0)),
    mgmt_fee_prorated: nullableInt(totals.s2),
    water_charge: utilCharge(water, savedUtilCharge("water", saved)),
    elec_charge: utilCharge(elec, savedUtilCharge("elec", saved)),
    gas_charge: utilCharge(gas, savedUtilCharge("gas", saved)),
    elec_paid_date: elec ? nullableText(elec.payDate) : null,
    gas_paid_date: gas ? nullableText(gas.payDate) : null,
    repair_amount: nullableInt(totals.s3),
    // 파트너 화면엔 귀책 입력이 없다. 서버(0236)가 기존 값을 유지하고, 정산 계좌도 기존 값이 있으면 유지한다.
    repair_attribution: null,
    repair_memo: nullableText(etcNames),
    settle_bank: ctx.settleAccount.settleBank,
    settle_acct: ctx.settleAccount.settleAcct,
    settle_holder: ctx.settleAccount.settleHolder,
    note: nullableText(state.memo),
    settlement_note: ctx.occupancy?.settlementNote ?? null,
    cleaning_cost: nullableInt(state.clnAmt),
    extra,
  };
}

// ===== RPC =====
type SettlementJson = {
  id: number;
  status: string;
  move_out_date: string | null;
  note: string | null;
  cleaning_cost: number | null;
  water_charge: number | null;
  elec_charge: number | null;
  gas_charge: number | null;
  elec_paid_date: string | null;
  gas_paid_date: string | null;
  repair_amount?: number | null;
  repair_memo?: string | null;
  extra: MSExtra | null;
};

export type ContextJson = {
  unit: { id: number; unit_no: string; dong: string | null; building_id: number; building_name: string };
  occupancy: {
    id: number;
    tenant_name: string | null;
    phone: string | null;
    move_in_date: string | null;
    settlement_note: string | null;
    status: string;
  } | null;
  latest_settlement: SettlementJson | null;
  settle_account: { settle_bank: string | null; settle_acct: string | null; settle_holder: string | null };
  checklist: { id: number; label: string; checked: boolean; note?: string | null }[];
  meter_summary: {
    utility: Utility;
    period?: string | null;
    previous_reading: number | null;
    current_reading: number | null;
    unit_price?: number | null;
    usage: number | null;
  }[];
  billing_unpaid?: number | null;
};

export function mapContext(r: ContextJson): PartnerSettlementContext {
  const s = r.latest_settlement;
  return {
    unit: {
      id: r.unit.id,
      unitNo: r.unit.unit_no,
      dong: r.unit.dong,
      buildingId: r.unit.building_id,
      buildingName: r.unit.building_name,
    },
    occupancy: r.occupancy
      ? {
          id: r.occupancy.id,
          tenantName: r.occupancy.tenant_name,
          phone: r.occupancy.phone,
          moveInDate: r.occupancy.move_in_date,
          settlementNote: r.occupancy.settlement_note,
          status: r.occupancy.status,
        }
      : null,
    latestSettlement: s
      ? {
          id: s.id,
          status: s.status,
          moveOutDate: s.move_out_date,
          note: s.note,
          cleaningCost: s.cleaning_cost,
          waterCharge: s.water_charge,
          elecCharge: s.elec_charge,
          gasCharge: s.gas_charge,
          elecPaidDate: s.elec_paid_date,
          gasPaidDate: s.gas_paid_date,
          repairAmount: s.repair_amount ?? null,
          repairMemo: s.repair_memo ?? null,
          extra: s.extra ?? null,
        }
      : null,
    settleAccount: {
      settleBank: r.settle_account.settle_bank,
      settleAcct: r.settle_account.settle_acct,
      settleHolder: r.settle_account.settle_holder,
    },
    checklist: r.checklist.map((c) => ({ id: c.id, label: c.label, checked: c.checked, note: c.note ?? null })),
    meterSummary: r.meter_summary.map((m) => ({
      utility: m.utility,
      period: m.period ?? null,
      previousReading: m.previous_reading,
      currentReading: m.current_reading,
      unitPrice: m.unit_price == null ? null : Number(m.unit_price),
      usage: m.usage,
    })),
    billingUnpaid: Number(r.billing_unpaid ?? 0) || 0,
  };
}
