import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in live integration test. Apply migration 0022 and provide a staff account
// that belongs to an active organization before running it.
const liveConfig = {
  url: process.env.P8_TEST_SUPABASE_URL ?? "",
  anonKey: process.env.P8_TEST_SUPABASE_ANON_KEY ?? "",
  serviceRoleKey: process.env.P8_TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
  staffEmail: process.env.P8_TEST_STAFF_EMAIL ?? "",
  staffPassword: process.env.P8_TEST_STAFF_PASSWORD ?? "",
};

const hasLiveConfig = Object.values(liveConfig).every(Boolean);
const liveDescribe = hasLiveConfig ? describe : describe.skip;

type OverdueAggregateDb = {
  occupancy_id: number;
  unit_id: number;
  overdue_amount: number | string;
  overdue_months: number;
  last_payment_date: string | null;
  billing_available: boolean;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

liveDescribe("list_overdue_aggregates RPC (live Supabase)", () => {
  const unitIds = new Map<string, number>();
  const occupancyIds = new Map<string, number>();
  let service: SupabaseClient | null = null;
  let staff: SupabaseClient | null = null;
  let buildingId: number | null = null;
  let orgId: number | null = null;

  beforeAll(async () => {
    const serviceClient = createClient(liveConfig.url, liveConfig.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const staffClient = createClient(liveConfig.url, liveConfig.anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    service = serviceClient;
    staff = staffClient;

    const signIn = await staffClient.auth.signInWithPassword({
      email: liveConfig.staffEmail,
      password: liveConfig.staffPassword,
    });
    throwIfError(signIn.error);

    const orgResponse = await staffClient.rpc("current_user_org");
    throwIfError(orgResponse.error);
    orgId = Number(orgResponse.data);
    if (!Number.isSafeInteger(orgId)) throw new Error("test staff has no active org");

    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const buildingResponse = await serviceClient
      .from("buildings")
      .insert({ org_id: orgId, code: `P8-${suffix}`, name: `P8 overdue ${suffix}` })
      .select("id")
      .single();
    throwIfError(buildingResponse.error);
    if (!buildingResponse.data) throw new Error("building fixture insert returned no row");
    buildingId = Number(buildingResponse.data.id);

    const unitsResponse = await serviceClient
      .from("units")
      .insert([
        { building_id: buildingId, unit_no: "101" },
        { building_id: buildingId, unit_no: "102" },
        { building_id: buildingId, unit_no: "103" },
      ])
      .select("id,unit_no");
    throwIfError(unitsResponse.error);
    for (const unit of unitsResponse.data ?? []) {
      unitIds.set(unit.unit_no, Number(unit.id));
    }

    const occupanciesResponse = await serviceClient
      .from("occupancies")
      .insert(["101", "102", "103"].map((unitNo) => ({
        unit_id: unitId(unitNo),
        tenant_name: `입주자 ${unitNo}`,
        status: "occupied",
      })))
      .select("id,unit_id");
    throwIfError(occupanciesResponse.error);
    for (const occupancy of occupanciesResponse.data ?? []) {
      const unitNo = [...unitIds.entries()].find(([, id]) => id === Number(occupancy.unit_id))?.[0];
      if (unitNo) occupancyIds.set(unitNo, Number(occupancy.id));
    }

    const confirmationsResponse = await serviceClient.from("billing_confirmations").insert([
      confirmation("101", "2026-06-01", 40_000),
      confirmation("101", "2026-07-01", 100_000),
      confirmation("101", "2026-08-01", 80_000),
      confirmation("102", "2026-08-01", 50_000),
    ]);
    throwIfError(confirmationsResponse.error);

    const paymentsResponse = await serviceClient.from("payments").insert([
      payment("101", "2026-06-01", 10_000, "2026-06-15"),
      payment("101", "2026-07-01", 120_000, "2026-07-20"),
      payment("101", "2026-08-01", 20_000, "2026-08-12"),
      payment("101", "2026-08-01", 70_000, "2026-09-20", "canceled"),
      payment("102", "2026-08-01", 50_000, "2026-08-10"),
    ]);
    throwIfError(paymentsResponse.error);
  });

  afterAll(async () => {
    if (buildingId !== null && service) {
      const cleanup = await service.from("buildings").delete().eq("id", buildingId);
      throwIfError(cleanup.error);
    }
    if (staff) await staff.auth.signOut();
  });

  function unitId(unitNo: string) {
    const id = unitIds.get(unitNo);
    if (id === undefined) throw new Error(`unit fixture missing: ${unitNo}`);
    return id;
  }

  function occupancyId(unitNo: string) {
    const id = occupancyIds.get(unitNo);
    if (id === undefined) throw new Error(`occupancy fixture missing: ${unitNo}`);
    return id;
  }

  function confirmation(unitNo: string, period: string, totalAmount: number) {
    return {
      unit_id: unitId(unitNo),
      occupancy_id: occupancyId(unitNo),
      period,
      total_amount: totalAmount,
      confirmed_at: "2026-08-18T00:00:00Z",
    };
  }

  function payment(
    unitNo: string,
    period: string,
    amount: number,
    paidAt: string,
    status: "active" | "canceled" = "active",
  ) {
    return {
      org_id: orgId,
      unit_id: unitId(unitNo),
      occupancy_id: occupancyId(unitNo),
      period,
      amount,
      method: "transfer",
      kind: "partial",
      paid_at: paidAt,
      status,
    };
  }

  async function list(scope: "all" | "current", year = 2026, month = 8) {
    if (buildingId === null || !staff) throw new Error("live fixtures missing");
    const response = await staff.rpc("list_overdue_aggregates", {
      p_building_id: buildingId,
      p_target_year: year,
      p_target_month: month,
      p_scope: scope,
    });
    throwIfError(response.error);
    return response.data as OverdueAggregateDb[];
  }

  function rowFor(rows: OverdueAggregateDb[], unitNo: string) {
    const row = rows.find((candidate) => Number(candidate.unit_id) === unitId(unitNo));
    if (!row) throw new Error(`aggregate row missing: ${unitNo}`);
    return {
      overdueAmount: Number(row.overdue_amount),
      overdueMonths: row.overdue_months,
      lastPaymentDate: row.last_payment_date,
      billingAvailable: row.billing_available,
    };
  }

  it("sums positive monthly balances without carrying an overpayment into another month", async () => {
    const rows = await list("all");

    expect(rowFor(rows, "101")).toEqual({
      overdueAmount: 90_000,
      overdueMonths: 2,
      lastPaymentDate: "2026-08-12",
      billingAvailable: true,
    });
  });

  it("limits current scope to the selected month", async () => {
    const rows = await list("current");

    expect(rowFor(rows, "101")).toMatchObject({
      overdueAmount: 60_000,
      overdueMonths: 1,
    });
  });

  it("distinguishes fully paid and never-billed occupancies", async () => {
    const rows = await list("all");

    expect(rowFor(rows, "102")).toMatchObject({
      overdueAmount: 0,
      overdueMonths: 0,
      billingAvailable: true,
    });
    expect(rowFor(rows, "103")).toEqual({
      overdueAmount: 0,
      overdueMonths: 0,
      lastPaymentDate: null,
      billingAvailable: false,
    });
  });
});
