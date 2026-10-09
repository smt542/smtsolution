import { createClient } from "@/lib/supabase/client";

export const UTILITY_TYPES = ["water", "electricity", "gas"] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

/** DB(unit_meters·meter_readings)는 'elec'을 쓴다(UI는 electricity). */
export function dbUtility(type: UtilityType): "water" | "elec" | "gas" {
  return type === "electricity" ? "elec" : type;
}

function utilityTypeFromDb(type: "water" | "elec" | "gas"): UtilityType {
  return type === "elec" ? "electricity" : type;
}

export interface UtilitySupplierRow {
  id: number;
  buildingId: number;
  utilityType: UtilityType;
  companyName: string | null;
  phone: string | null;
  bank: string | null;
  accountNo: string | null;
  accountHolder: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UtilitySupplierDbRow {
  id: number;
  building_id: number;
  utility: "water" | "elec" | "gas";
  company_name: string | null;
  phone: string | null;
  bank: string | null;
  account_no: string | null;
  account_holder: string | null;
  created_at: string;
  updated_at: string;
}

export async function getUtilitySupplier(
  buildingId: number,
  utilityType: UtilityType,
): Promise<UtilitySupplierRow | null> {
  const { data, error } = await createClient()
    .from("building_utility_suppliers")
    .select(
      "id, building_id, utility, company_name, phone, bank, account_no, account_holder, created_at, updated_at",
    )
    .eq("building_id", buildingId)
    .eq("utility", dbUtility(utilityType))
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as UtilitySupplierDbRow;
  return {
    id: row.id,
    buildingId: row.building_id,
    utilityType: utilityTypeFromDb(row.utility),
    companyName: row.company_name,
    phone: row.phone,
    bank: row.bank,
    accountNo: row.account_no,
    accountHolder: row.account_holder,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface SaveUtilitySupplierInput {
  buildingId: number;
  utilityType: UtilityType;
  companyName: string | null;
  phone: string | null;
  bank: string | null;
  accountNo: string | null;
  accountHolder: string | null;
}

export async function saveUtilitySupplier(
  input: SaveUtilitySupplierInput,
): Promise<void> {
  const { error } = await createClient()
    .from("building_utility_suppliers")
    .upsert(
      {
        building_id: input.buildingId,
        utility: dbUtility(input.utilityType),
        company_name: input.companyName,
        phone: input.phone,
        bank: input.bank,
        account_no: input.accountNo,
        account_holder: input.accountHolder,
      },
      { onConflict: "building_id,utility" },
    );
  if (error) throw new Error(error.message);
}

export interface UtilityUnitRow {
  unitId: number;
  unitNo: string;
  dong: string | null;
  occupancyId: number | null;
  tenantName: string | null;
  occupancyStatus: "occupied" | "vacant" | "moving_out" | null;
  moveInDate: string | null;
  moveOutDate?: string | null;
  moveOutScheduledDate?: string | null;
  phone?: string | null;
  residentCount?: number | null;
  customerNumber: string | null;
  meterNumber: string | null;
  previousReading: number | null;
  currentReading: number | null;
  usage: number | null;
  previousUsage?: number | null;
  unitPrice: number | null;
  resolvedUnitPrice: number | null;
  automaticCharge: number | null;
  manualCharge: number | null;
  note: string | null;
  processedAt: string | null;
  discountType: string | null;
  discountAmount: number | null;
  /** Server-authoritative review flag (e.g. negative computed usage). Always
   *  populated by listUtilityRows; optional so existing row fixtures stay valid. */
  needsReview?: boolean;
}

interface UtilityRowRpc {
  unit_id: number;
  unit_no: string;
  dong: string | null;
  occupancy_id: number | null;
  tenant_name: string | null;
  occupancy_status: UtilityUnitRow["occupancyStatus"];
  move_in_date: string | null;
  move_out_date?: string | null;
  move_out_scheduled_date?: string | null;
  phone?: string | null;
  resident_count?: number | null;
  customer_no: string | null;
  meter_no: string | null;
  previous_reading: number | null;
  current_reading: number | null;
  usage: number | null;
  previous_usage?: number | null;
  unit_price: number | null;
  calc_charge: number | null;
  discount_amount: number | null;
  manual_charge: number | null;
  note: string | null;
  processed_at: string | null;
  discount_type: string | null;
  resolved_unit_price: number | null;
  needs_review: boolean | null;
}

function rpcToUtilityRow(r: UtilityRowRpc): UtilityUnitRow {
  return {
    unitId: r.unit_id,
    unitNo: r.unit_no,
    dong: r.dong,
    occupancyId: r.occupancy_id,
    tenantName: r.tenant_name,
    occupancyStatus: r.occupancy_status,
    moveInDate: r.move_in_date,
    moveOutDate: r.move_out_date ?? null,
    moveOutScheduledDate: r.move_out_scheduled_date ?? null,
    phone: r.phone ?? null,
    residentCount: r.resident_count ?? null,
    customerNumber: r.customer_no,
    meterNumber: r.meter_no,
    previousReading: r.previous_reading,
    currentReading: r.current_reading,
    usage: r.usage,
    previousUsage: r.previous_usage ?? null,
    unitPrice: r.unit_price,
    resolvedUnitPrice: r.resolved_unit_price,
    automaticCharge: r.calc_charge,
    manualCharge: r.manual_charge,
    note: r.note,
    processedAt: r.processed_at,
    discountType: r.discount_type,
    discountAmount: r.discount_amount,
    needsReview: r.needs_review ?? false,
  };
}

/** period: 'YYYY-MM-01'(월1일). */
export async function listUtilityRows(
  buildingId: number,
  utilityType: UtilityType,
  period: string,
): Promise<UtilityUnitRow[]> {
  const { data, error } = await createClient().rpc("list_utility_rows", {
    p_building_id: buildingId,
    p_utility: dbUtility(utilityType),
    p_period: period,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as UtilityRowRpc[]).map(rpcToUtilityRow);
}

export interface SaveMeterReadingsInput {
  buildingId: number;
  utilityType: UtilityType;
  period: string;
  rows: {
    unit_id: number;
    previous_reading?: string;
    current_reading?: string;
    usage?: string;
    manual_charge: string;
    note: string;
  }[];
}
export interface SaveMeterReadingsResult {
  saved: number;
  period: string;
  totalCalc?: number;
}

export async function saveMeterReadings(
  input: SaveMeterReadingsInput,
): Promise<SaveMeterReadingsResult> {
  const { data, error } = await createClient().rpc("save_meter_readings", {
    p_building_id: input.buildingId,
    p_utility: dbUtility(input.utilityType),
    p_period: input.period,
    p_rows: input.rows,
  });
  if (error) throw new Error(error.message);
  const d = data as { saved: number; period: string; total_calc?: number };
  return {
    saved: d.saved,
    period: d.period,
    ...(d.total_calc === undefined ? {} : { totalCalc: d.total_calc }),
  };
}

interface UtilityPriceRpc {
  customer_number_id: number;
  customer_no: string;
  holder_name: string | null;
  sort_order: number;
  unit_price: number | null;
}

export interface UtilityPriceRow {
  customerNumberId: number;
  customerNo: string;
  holderName: string | null;
  sortOrder: number;
  unitPrice: number | null;
}

export async function listUtilityPrices(
  buildingId: number,
  utilityType: UtilityType,
): Promise<UtilityPriceRow[]> {
  const { data, error } = await createClient().rpc("list_utility_prices", {
    p_building_id: buildingId,
    p_utility: dbUtility(utilityType),
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as UtilityPriceRpc[]).map((row) => ({
    customerNumberId: row.customer_number_id,
    customerNo: row.customer_no,
    holderName: row.holder_name,
    sortOrder: row.sort_order,
    unitPrice: row.unit_price,
  }));
}

export interface SaveUtilityUnitPricesInput {
  buildingId: number;
  utilityType: UtilityType;
  prices: { customer_number_id: number; unit_price: number }[];
}

export interface SaveUtilityUnitPricesResult {
  saved: number;
}

export async function saveUtilityUnitPrices(
  input: SaveUtilityUnitPricesInput,
): Promise<SaveUtilityUnitPricesResult> {
  const { data, error } = await createClient().rpc("save_utility_unit_prices", {
    p_building_id: input.buildingId,
    p_utility: dbUtility(input.utilityType),
    p_prices: input.prices,
  });
  if (error) throw new Error(error.message);
  return { saved: (data as { saved: number }).saved };
}

export type ScopedUsageType = "residential" | "commercial";

export interface ScopedPriceRow {
  usage_type: ScopedUsageType;
  floor: number | null;
  unit_price: number;
}

export async function listScopedPrices(
  buildingId: number,
  utilityType: UtilityType,
): Promise<ScopedPriceRow[]> {
  const { data, error } = await createClient()
    .from("utility_scoped_prices")
    .select("usage_type, floor, unit_price")
    .eq("building_id", buildingId)
    .eq("utility", dbUtility(utilityType));
  if (error) throw new Error(error.message);
  return ((data ?? []) as ScopedPriceRow[]).map((row) => ({
    usage_type: row.usage_type,
    floor: row.floor,
    unit_price: Number(row.unit_price),
  }));
}

export interface SaveScopedPricesResult {
  saved: number;
}

export async function saveScopedPrices(
  buildingId: number,
  utilityType: UtilityType,
  rows: ScopedPriceRow[],
): Promise<SaveScopedPricesResult> {
  if (rows.length === 0) return { saved: 0 };

  const { error } = await createClient()
    .from("utility_scoped_prices")
    .upsert(
      rows.map((row) => ({
        building_id: buildingId,
        utility: dbUtility(utilityType),
        usage_type: row.usage_type,
        floor: row.floor,
        unit_price: row.unit_price,
      })),
      { onConflict: "building_id,utility,usage_type,floor" },
    );
  if (error) throw new Error(error.message);
  return { saved: rows.length };
}

export interface SaveScopedPricesInput {
  buildingId: number;
  utilityType: UtilityType;
  rows: ScopedPriceRow[];
}

export interface BillingPeriodRow {
  chargeStartDate: string;
  chargeEndDate: string;
  dueDate: string | null;
}

interface BillingPeriodDbRow {
  charge_start_date: string;
  charge_end_date: string;
  due_date: string | null;
}

export async function getBillingPeriod(
  buildingId: number,
  period: string,
): Promise<BillingPeriodRow | null> {
  const { data, error } = await createClient()
    .from("billing_period_settings")
    .select("charge_start_date, charge_end_date, due_date")
    .eq("building_id", buildingId)
    .eq("period", period)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as BillingPeriodDbRow;
  return {
    chargeStartDate: row.charge_start_date,
    chargeEndDate: row.charge_end_date,
    dueDate: row.due_date,
  };
}

export interface SaveBillingPeriodInput {
  buildingId: number;
  period: string;
  chargeStartDate: string;
  chargeEndDate: string;
}

export async function saveBillingPeriod(input: SaveBillingPeriodInput): Promise<void> {
  const { error } = await createClient()
    .from("billing_period_settings")
    .upsert(
      {
        building_id: input.buildingId,
        period: input.period,
        charge_start_date: input.chargeStartDate,
        charge_end_date: input.chargeEndDate,
      },
      { onConflict: "building_id,period" },
    );
  if (error) throw new Error(error.message);
}

/** 호실별 지침 자물쇠는 unit_fixed_values 의 달별 이력으로 저장한다. */
export type FixedValueKind = "usage" | "manual";

/** 호실별 자물쇠 이력 한 줄: fromPeriod 월부터 value 로 고정, null 이면 해제. */
export interface FixedValueEntry {
  unitId: number;
  kind: FixedValueKind;
  fromPeriod: string;
  value: number | null;
}

interface FixedValueDbRow {
  unit_id: number;
  kind: FixedValueKind;
  from_period: string;
  value: number | string | null;
}

export async function listFixedValues(
  buildingId: number,
  utilityType: UtilityType,
): Promise<FixedValueEntry[]> {
  const { data, error } = await createClient()
    .from("unit_fixed_values")
    .select("unit_id, kind, from_period, value, units!inner(building_id, deleted_at)")
    .eq("utility", dbUtility(utilityType))
    .eq("units.building_id", buildingId)
    .is("units.deleted_at", null)
    .order("unit_id")
    .order("from_period");
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as FixedValueDbRow[]).map((row) => ({
    unitId: row.unit_id,
    kind: row.kind,
    fromPeriod: row.from_period,
    value: row.value === null ? null : Number(row.value),
  }));
}

export interface FixedValueChange {
  unitId: number;
  kind: FixedValueKind;
  value: number | null;
}

export interface SaveFixedValuesInput {
  buildingId: number;
  utilityType: UtilityType;
  period: string;
  changes: FixedValueChange[];
}

/** 호실별 자물쇠 변경을 해당 월의 이력 행으로 저장한다(null 이면 해제). */
export async function saveFixedValues(input: SaveFixedValuesInput): Promise<void> {
  if (input.changes.length === 0) return;
  const { error } = await createClient().rpc("save_unit_fixed_values", {
    p_building_id: input.buildingId,
    p_utility: dbUtility(input.utilityType),
    p_period: input.period,
    p_rows: input.changes.map((change) => ({
      unit_id: change.unitId,
      kind: change.kind,
      value: change.value,
    })),
  });
  if (error) throw new Error(error.message);
}

export interface ConfirmUtilitiesInput {
  buildingId: number;
  utilityType: UtilityType;
  period: string;
}

export interface ConfirmUtilitiesResult {
  unitCount: number;
  total: number;
}

export async function confirmUtilities(
  input: ConfirmUtilitiesInput,
): Promise<ConfirmUtilitiesResult> {
  const { data, error } = await createClient().rpc("confirm_utilities", {
    p_building_id: input.buildingId,
    p_utility: dbUtility(input.utilityType),
    p_period: input.period,
  });
  if (error) throw new Error(error.message);
  const result = data as { unit_count: number; total: number };
  return { unitCount: result.unit_count, total: result.total };
}

interface UtilityConfirmationRpc {
  confirmed_at: string;
  confirmed_by_name: string | null;
  unit_count: number;
  total_amount: number;
  is_dirty: boolean;
}

export interface UtilityConfirmation {
  confirmedAt: string;
  confirmedByName: string | null;
  unitCount: number;
  totalAmount: number;
  isDirty: boolean;
}

export async function getUtilityConfirmation(
  buildingId: number,
  utilityType: UtilityType,
  period: string,
): Promise<UtilityConfirmation | null> {
  const { data, error } = await createClient().rpc("list_utility_confirmation", {
    p_building_id: buildingId,
    p_utility: dbUtility(utilityType),
    p_period: period,
  });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as UtilityConfirmationRpc[])[0];
  return row
    ? {
        confirmedAt: row.confirmed_at,
        confirmedByName: row.confirmed_by_name,
        unitCount: row.unit_count,
        totalAmount: row.total_amount,
        isDirty: row.is_dirty,
      }
    : null;
}

export function ledgerDownloadUrl(
  buildingId: number,
  utilityType: UtilityType,
  period: string,
): string {
  const params = new URLSearchParams({
    buildingId: String(buildingId),
    utility: dbUtility(utilityType),
    period,
  });
  return `/api/utilities/ledger?${params.toString()}`;
}

export type WaterDiscountType = "recipient" | "multichild" | "other";
export interface SaveWaterDiscountInput {
  unitId: number;
  discountType: WaterDiscountType;
  amount: number;
  memo?: string | null;
}

export async function saveWaterDiscount(input: SaveWaterDiscountInput): Promise<void> {
  const { error } = await createClient()
    .from("water_discounts")
    .upsert(
      {
        unit_id: input.unitId,
        discount_type: input.discountType,
        amount: input.amount,
        memo: input.memo ?? null,
      },
      { onConflict: "unit_id" },
    );
  if (error) throw new Error(error.message);
}

export async function deleteWaterDiscount(unitId: number): Promise<void> {
  const { error } = await createClient().from("water_discounts").delete().eq("unit_id", unitId);
  if (error) throw new Error(error.message);
}

export interface MeterHistoryRow {
  period: string;
  charge: number | null;
  unitPrice: number | null;
}

export async function listMeterHistory(
  unitId: number,
  utilityType: UtilityType,
  period: string,
): Promise<MeterHistoryRow[]> {
  const { data, error } = await createClient()
    .from("meter_readings")
    .select("period, manual_charge, calc_charge, unit_price")
    .eq("unit_id", unitId)
    .eq("utility", dbUtility(utilityType))
    .lte("period", period)
    .order("period", { ascending: false })
    .limit(6);
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as {
      period: string;
      manual_charge: number | null;
      calc_charge: number | null;
      unit_price: number | null;
    }[]
  ).map((r) => ({
    period: r.period,
    charge: r.manual_charge ?? r.calc_charge,
    unitPrice: r.unit_price,
  }));
}

export interface PartnerMeterValue {
  previous: string;
  current: string;
}

export type PartnerMeterUtility = "water" | "elec" | "gas";

export interface PartnerMeterOverduePeriod {
  period: string;
  unpaidPrincipal: number;
  dueDate: string;
  /** 입주의 연체료 부과 여부(occupancies.late_fee_enabled). false 면 연체료 0. */
  lateFeeEnabled: boolean;
}

export interface PartnerMeterUnit {
  unitId: number;
  unitNo: string;
  dong: string | null;
  tenantName: string | null;
  meters: Record<string, PartnerMeterValue>;
  /** 지금 입주 중인 점유. 공실이면 null. */
  occupancyId: number | null;
  moveInDate: string | null;
  /** 서버에서 마스킹한 연락처. */
  phone: string | null;
  /** 입주민 연락처 전체(주번호 + 부번호, 빈 값 제외·등록 순서). */
  phones: string[];
  /** 그 달 공과금별 적요(빈 값 제외). */
  notes: Partial<Record<PartnerMeterUtility, string>>;
  /** 공과금별 사용량 [1개월 전, 2개월 전, 3개월 전]. */
  usageHistory: Partial<Record<PartnerMeterUtility, (number | null)[]>>;
  /** 그 달 검침에 저장한 전.량(전월 사용량) 수정값. 없으면 직전 달 사용량을 상속한다(0273). */
  prevUsageOverrides: Partial<Record<PartnerMeterUtility, number>>;
  /** 선택한 달까지 부과확정 고지서 중 덜 낸 달(미납관리와 같은 식, 0214). */
  overduePeriods: PartnerMeterOverduePeriod[];
}

export interface PartnerMeterWorkspaceData {
  buildingName: string;
  units: PartnerMeterUnit[];
}

interface PartnerMeterRpcRow {
  unit_id: number;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  utility: string;
  previous_reading: number | null;
  current_reading: number | null;
}

interface PartnerMeterCardRpcRow {
  unit_id: number;
  occupancy_id: number | null;
  move_in_date: string | null;
  phone: string | null;
  phones_more?: string[] | null;
  notes: Partial<Record<PartnerMeterUtility, string>> | null;
  usage_history: Partial<Record<PartnerMeterUtility, (number | null)[]>> | null;
  prev_usage_overrides?: Partial<Record<PartnerMeterUtility, number>> | null;
  overdue_periods: { period: string; unpaid_principal: number; due_date: string; late_fee_enabled?: boolean }[] | null;
}

function groupPartnerMeterRows(
  rows: PartnerMeterRpcRow[],
  cards: PartnerMeterCardRpcRow[],
): PartnerMeterUnit[] {
  const cardByUnit = new Map(cards.map((card) => [card.unit_id, card]));
  const units = new Map<number, PartnerMeterUnit>();
  for (const row of rows) {
    const card = cardByUnit.get(row.unit_id);
    const unit = units.get(row.unit_id) ?? {
      unitId: row.unit_id,
      unitNo: row.unit_no,
      dong: row.dong,
      tenantName: row.tenant_name,
      meters: {},
      occupancyId: card?.occupancy_id ?? null,
      moveInDate: card?.move_in_date ?? null,
      phone: card?.phone ?? null,
      phones: [card?.phone ?? null, ...(card?.phones_more ?? [])].filter(
        (phone): phone is string => Boolean(phone && phone.trim()),
      ),
      notes: card?.notes ?? {},
      usageHistory: card?.usage_history ?? {},
      prevUsageOverrides: card?.prev_usage_overrides ?? {},
      overduePeriods: (card?.overdue_periods ?? []).map((item) => ({
        period: item.period,
        unpaidPrincipal: Number(item.unpaid_principal),
        dueDate: item.due_date,
        lateFeeEnabled: item.late_fee_enabled ?? true,
      })),
    };
    unit.meters[row.utility] = {
      previous: row.previous_reading === null ? "" : String(row.previous_reading),
      current: row.current_reading === null ? "" : String(row.current_reading),
    };
    units.set(row.unit_id, unit);
  }
  return [...units.values()];
}

export async function getPartnerMeterWorkspace(
  buildingId: number,
  period: string,
): Promise<PartnerMeterWorkspaceData> {
  const supabase = createClient();
  const [buildingResult, readingsResult, cardsResult] = await Promise.all([
    supabase.rpc("partner_get_building", { p_building_id: buildingId }),
    supabase.rpc("partner_list_meter_readings", {
      p_building_id: buildingId,
      p_period: period,
    }),
    supabase.rpc("partner_list_meter_cards", {
      p_building_id: buildingId,
      p_period: period,
    }),
  ]);
  if (buildingResult.error) throw new Error(buildingResult.error.message);
  if (readingsResult.error) throw new Error(readingsResult.error.message);
  if (cardsResult.error) throw new Error(cardsResult.error.message);

  const building = Array.isArray(buildingResult.data)
    ? buildingResult.data[0]
    : buildingResult.data;
  return {
    buildingName: building?.name ?? "",
    units: groupPartnerMeterRows(
      Array.isArray(readingsResult.data)
        ? (readingsResult.data as PartnerMeterRpcRow[])
        : [],
      Array.isArray(cardsResult.data)
        ? (cardsResult.data as PartnerMeterCardRpcRow[])
        : [],
    ),
  };
}

export interface SavePartnerMeterReadingsInput {
  buildingId: number;
  period: string;
  readings: {
    unit_id: number;
    utility: string;
    previous_reading: string;
    current_reading: string;
    /** 전.량 수정값. 빈 문자열이면 수정값을 지우고 직전 달 사용량을 상속한다. */
    prev_usage: string;
  }[];
}

export async function savePartnerMeterReadings(
  input: SavePartnerMeterReadingsInput,
): Promise<void> {
  const { error } = await createClient().rpc("partner_save_meter_readings", {
    p_building_id: input.buildingId,
    p_period: input.period,
    p_readings: input.readings,
  });
  if (error) throw new Error(error.message);
}
