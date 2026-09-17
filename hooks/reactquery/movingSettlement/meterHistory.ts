import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface MeterHistoryRow {
  period: string;
  year: number;
  month: number;
  waterPrev: number | null;
  waterCurr: number | null;
  waterUsage: number | null;
  elecPrev: number | null;
  elecCurr: number | null;
  elecUsage: number | null;
  gasPrev: number | null;
  gasCurr: number | null;
  monthTotal: number | null;
  paidAt: string | null;
}

type NumericValue = number | string | null;

interface MeterReadingRecord {
  period: string;
  utility: "water" | "elec" | "gas";
  previous_reading: NumericValue;
  current_reading: NumericValue;
  usage: NumericValue;
}

interface FeeItemChargeRecord {
  period: string;
  amount: NumericValue;
}

interface PaymentRecord {
  period: string;
  paid_at: string | null;
}

function toNullableNumber(value: NumericValue): number | null {
  return value == null ? null : Number(value);
}

export async function listUnitMeterHistory(
  unitId: number,
  months = 6,
): Promise<MeterHistoryRow[]> {
  const client = createClient();
  const { data: meterData, error: meterError } = await client
    .from("meter_readings")
    .select("period, utility, previous_reading, current_reading, usage")
    .eq("unit_id", unitId)
    .order("period", { ascending: false })
    .limit(months * 3 + 12);

  if (meterError) throw new Error(meterError.message);

  const meterRows = (meterData ?? []) as MeterReadingRecord[];
  const periods = Array.from(new Set(meterRows.map((row) => row.period)))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, months);

  if (periods.length === 0) return [];

  const [{ data: chargeData, error: chargeError }, { data: paymentData, error: paymentError }] =
    await Promise.all([
      client
        .from("fee_item_charges")
        .select("period, amount")
        .eq("unit_id", unitId)
        .eq("charged", true)
        .in("period", periods),
      client
        .from("payments")
        .select("period, paid_at")
        .eq("unit_id", unitId)
        .eq("status", "active")
        .in("period", periods),
    ]);

  if (chargeError) throw new Error(chargeError.message);
  if (paymentError) throw new Error(paymentError.message);

  const rowsByPeriod = new Map<string, MeterHistoryRow>(
    periods.map((period) => {
      const [year, month] = period.split("-").map(Number);
      return [
        period,
        {
          period,
          year,
          month,
          waterPrev: null,
          waterCurr: null,
          waterUsage: null,
          elecPrev: null,
          elecCurr: null,
          elecUsage: null,
          gasPrev: null,
          gasCurr: null,
          monthTotal: null,
          paidAt: null,
        },
      ];
    }),
  );

  for (const meter of meterRows) {
    const row = rowsByPeriod.get(meter.period);
    if (!row) continue;

    if (meter.utility === "water") {
      row.waterPrev = toNullableNumber(meter.previous_reading);
      row.waterCurr = toNullableNumber(meter.current_reading);
      row.waterUsage = toNullableNumber(meter.usage);
    } else if (meter.utility === "elec") {
      row.elecPrev = toNullableNumber(meter.previous_reading);
      row.elecCurr = toNullableNumber(meter.current_reading);
      row.elecUsage = toNullableNumber(meter.usage);
    } else {
      row.gasPrev = toNullableNumber(meter.previous_reading);
      row.gasCurr = toNullableNumber(meter.current_reading);
    }
  }

  const totalsByPeriod = new Map<string, number>();
  for (const charge of (chargeData ?? []) as FeeItemChargeRecord[]) {
    const amount = toNullableNumber(charge.amount);
    if (amount === null) continue;
    const currentTotal = totalsByPeriod.get(charge.period) ?? 0;
    totalsByPeriod.set(charge.period, currentTotal + amount);
  }

  for (const payment of (paymentData ?? []) as PaymentRecord[]) {
    if (!payment.paid_at) continue;
    const row = rowsByPeriod.get(payment.period);
    if (row && (!row.paidAt || payment.paid_at > row.paidAt)) {
      row.paidAt = payment.paid_at;
    }
  }

  for (const [period, row] of rowsByPeriod) {
    row.monthTotal = totalsByPeriod.get(period) ?? null;
  }

  return periods.map((period) => rowsByPeriod.get(period) as MeterHistoryRow);
}

export function useUnitMeterHistory(unitId: number | null, months = 6) {
  return useQuery({
    queryKey: ["movingSettlement", "meterHistory", unitId, months],
    queryFn: () => listUnitMeterHistory(unitId as number, months),
    enabled: unitId !== null,
  });
}
