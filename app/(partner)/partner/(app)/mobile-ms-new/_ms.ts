import { formatWon } from "@/lib/format";

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

export type FeeItem = { name: string; daily: boolean; charged: number };
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
  previousReading: number | null;
  currentReading: number | null;
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
export function toNumber(value: unknown): number {
  const n = Number(String(value ?? "").replace(/[^0-9-]/g, ""));
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

export function utilUsage(u: UtilRow): number {
  return Math.max(0, (u.cur || 0) - (u.prev || 0));
}

export function feeProrated(f: FeeItem, dTotal: number, dDays: number): number {
  if (f.daily && dTotal > 0) return Math.round((f.charged || 0) * dDays / dTotal);
  return f.charged || 0;
}

export type MSTotals = {
  s1: number; // 공과금 소계
  s2: number; // 관리비 소계 (관리비 정산 + 가수금)
  s3: number; // 기타 소계
  cleaning: number;
  unpaidSubtotal: number; // 미납 소계
  balance: number; // 미수금
};

export function computeTotals(state: MSState): MSTotals {
  const s1 = state.util.reduce((t, u) => t + utilAmount(u), 0);
  const feeSum = state.feeItems.reduce(
    (t, f) => t + feeProrated(f, state.dTotal, state.dDays),
    0,
  );
  const s2 = feeSum + (state.adv || 0);
  const s3 = state.etcItems.reduce((t, x) => t + (x.amount || 0), 0);
  const cleaning = state.clnAmt || 0;
  const unpaidSubtotal = s1 + s2 + s3 + cleaning;
  const balance = unpaidSubtotal - (state.paid || 0);
  return { s1, s2, s3, cleaning, unpaidSubtotal, balance };
}

// ===== 초기 상태 =====
function seededUtil(meters: PartnerMeter[], saved?: MSExtra["util"]): UtilRow[] {
  // 정본 카드 순서: 전기 · 수도 · 가스
  const order: Utility[] = ["elec", "water", "gas"];
  return order.map((k) => {
    const savedRow = saved?.find((r) => r.k === k);
    if (savedRow) {
      return {
        k,
        prev: savedRow.prev ?? 0,
        cur: savedRow.cur ?? 0,
        price: savedRow.price ?? 0,
        acct: savedRow.acct ?? "",
        payDate: savedRow.payDate ?? "",
      };
    }
    const meter = meters.find((m) => m.utility === k);
    return {
      k,
      prev: meter?.previousReading ?? 0,
      cur: meter?.currentReading ?? 0,
      price: 0,
      acct: "",
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

  const util = seededUtil(ctx.meterSummary, extra?.util);
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
    dDays: extra?.dDays ?? 0,
    util,
    feeItems:
      extra?.feeItems && extra.feeItems.length > 0
        ? extra.feeItems.map((f) => ({ name: f.name, daily: !!f.daily, charged: f.charged || 0 }))
        : DEFAULT_FEE_ITEMS.map((f) => ({ ...f })),
    adv: extra?.adv ?? 0,
    advTel: extra?.advTel ?? "",
    etcItems:
      extra?.etcItems && extra.etcItems.length > 0
        ? extra.etcItems.map((x) => ({ name: x.name, amount: x.amount || 0 }))
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
  const totals = computeTotals(state);
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

  // 단가 또는 이사 지침이 비어 있는 행(사무실 PC 작성분·지침 미입력 등)은 금액을 계산할 수 없으므로
  // 저장된 공과금 금액을 그대로 유지한다(0/null 로 덮어쓰지 않음). 금액 = max(0, 이사−전월) × 단가(0266).
  const saved = ctx.latestSettlement;
  const utilCharge = (u: UtilRow | undefined, savedCharge: number | null | undefined) => {
    if (!u) return null;
    if (!u.price || !u.cur) return savedCharge ?? null;
    return nullableInt(utilAmount(u));
  };

  return {
    move_out_date: state.moveOutDate,
    mgmt_fee_monthly: nullableInt(state.feeItems.reduce((t, f) => t + (f.charged || 0), 0)),
    mgmt_fee_prorated: nullableInt(totals.s2),
    water_charge: utilCharge(water, saved?.waterCharge),
    elec_charge: utilCharge(elec, saved?.elecCharge),
    gas_charge: utilCharge(gas, saved?.gasCharge),
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
    previous_reading: number | null;
    current_reading: number | null;
    usage: number | null;
  }[];
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
      previousReading: m.previous_reading,
      currentReading: m.current_reading,
      usage: m.usage,
    })),
  };
}
