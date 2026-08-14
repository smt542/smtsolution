import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Opt-in live integration test. The staff account must belong to an active org
// and have the utilities module. Apply migration 0016 before running it.
const liveConfig = {
  url: process.env.P5C_TEST_SUPABASE_URL ?? "",
  anonKey: process.env.P5C_TEST_SUPABASE_ANON_KEY ?? "",
  serviceRoleKey: process.env.P5C_TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
  staffEmail: process.env.P5C_TEST_STAFF_EMAIL ?? "",
  staffPassword: process.env.P5C_TEST_STAFF_PASSWORD ?? "",
};

const hasLiveConfig = Object.values(liveConfig).every(Boolean);
const liveDescribe = hasLiveConfig ? describe : describe.skip;
const period = "2026-08-01";
const previousPeriod = "2026-07-01";

type ReadingSnapshot = {
  usage: number | string | null;
  unit_price: number | string | null;
  calc_charge: number | null;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function asNumber(value: number | string | null) {
  return value === null ? null : Number(value);
}

liveDescribe("P5c save_meter_readings RPC (live Supabase)", () => {
  const unitIds = new Map<string, number>();
  let service: SupabaseClient | null = null;
  let staff: SupabaseClient | null = null;
  let buildingId: number | null = null;

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
    const orgId = Number(orgResponse.data);
    if (!Number.isSafeInteger(orgId)) throw new Error("test staff has no active org");

    const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const buildingResponse = await serviceClient
      .from("buildings")
      .insert({ org_id: orgId, code: `P5C-${suffix}`, name: `P5c RPC ${suffix}` })
      .select("id")
      .single();
    throwIfError(buildingResponse.error);
    if (!buildingResponse.data) throw new Error("building fixture insert returned no row");
    buildingId = Number(buildingResponse.data.id);

    const unitsResponse = await serviceClient
      .from("units")
      .insert([
        { building_id: buildingId, unit_no: "301", usage_type: "residential", floor: 3 },
        { building_id: buildingId, unit_no: "201", usage_type: "commercial", floor: 2 },
        { building_id: buildingId, unit_no: "302", usage_type: "commercial", floor: 3 },
        { building_id: buildingId, unit_no: "401", usage_type: "residential", floor: 4 },
        { building_id: buildingId, unit_no: "501", usage_type: "residential", floor: 5 },
        { building_id: buildingId, unit_no: "601", usage_type: "residential", floor: 6 },
      ])
      .select("id,unit_no");
    throwIfError(unitsResponse.error);
    for (const unit of unitsResponse.data ?? []) {
      unitIds.set(unit.unit_no, Number(unit.id));
    }

    const customerNumbersResponse = await serviceClient
      .from("building_customer_numbers")
      .insert([
        { building_id: buildingId, kind: "water", customer_no: `W-${suffix}` },
        { building_id: buildingId, kind: "gas", customer_no: `G-${suffix}` },
      ])
      .select("id,kind,customer_no");
    throwIfError(customerNumbersResponse.error);
    const waterCustomer = customerNumbersResponse.data?.find((row) => row.kind === "water");
    const gasCustomer = customerNumbersResponse.data?.find((row) => row.kind === "gas");
    if (!waterCustomer || !gasCustomer) throw new Error("customer-number fixtures missing");

    const pricesResponse = await serviceClient.from("utility_unit_prices").insert([
      { building_customer_number_id: waterCustomer.id, unit_price: 90 },
      { building_customer_number_id: gasCustomer.id, unit_price: 40 },
    ]);
    throwIfError(pricesResponse.error);

    const scopedPricesResponse = await serviceClient.from("utility_scoped_prices").insert([
      {
        building_id: buildingId,
        utility: "water",
        usage_type: "residential",
        floor: 3,
        unit_price: 70,
      },
      {
        building_id: buildingId,
        utility: "water",
        usage_type: "commercial",
        floor: 2,
        unit_price: 80,
      },
      {
        building_id: buildingId,
        utility: "water",
        usage_type: "commercial",
        floor: null,
        unit_price: 60,
      },
    ]);
    throwIfError(scopedPricesResponse.error);

    const metersResponse = await serviceClient.from("unit_meters").insert([
      {
        unit_id: unitId("301"),
        utility: "water",
        customer_no: waterCustomer.customer_no,
      },
      { unit_id: unitId("601"), utility: "water", fixed_usage: 7 },
    ]);
    throwIfError(metersResponse.error);

    const previousReadingsResponse = await serviceClient.from("meter_readings").insert([
      { unit_id: unitId("301"), utility: "water", period: previousPeriod, current_reading: 100 },
      { unit_id: unitId("201"), utility: "water", period: previousPeriod, current_reading: 100 },
      { unit_id: unitId("302"), utility: "water", period: previousPeriod, current_reading: 100 },
      { unit_id: unitId("401"), utility: "gas", period: previousPeriod, current_reading: 100 },
      { unit_id: unitId("501"), utility: "elec", period: previousPeriod, current_reading: 100 },
      { unit_id: unitId("601"), utility: "water", period: previousPeriod, current_reading: 100 },
    ]);
    throwIfError(previousReadingsResponse.error);
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

  async function saveAndRead(
    unitNo: string,
    utility: "water" | "elec" | "gas",
    currentReading: string,
  ) {
    if (buildingId === null || !staff || !service) throw new Error("live fixtures missing");
    const staffClient = staff;
    const serviceClient = service;
    const id = unitId(unitNo);
    const saveResponse = await staffClient.rpc("save_meter_readings", {
      p_building_id: buildingId,
      p_utility: utility,
      p_period: period,
      p_rows: [{ unit_id: id, current_reading: currentReading, manual_charge: "", note: "" }],
    });
    throwIfError(saveResponse.error);

    const readingResponse = await serviceClient
      .from("meter_readings")
      .select("usage,unit_price,calc_charge")
      .eq("unit_id", id)
      .eq("utility", utility)
      .eq("period", period)
      .single();
    throwIfError(readingResponse.error);
    const reading = readingResponse.data as unknown as ReadingSnapshot;
    return {
      usage: asNumber(reading.usage),
      unitPrice: asNumber(reading.unit_price),
      calcCharge: reading.calc_charge,
    };
  }

  it("prefers a unit customer-number custom price over scoped prices", async () => {
    await expect(saveAndRead("301", "water", "110")).resolves.toEqual({
      usage: 10,
      unitPrice: 90,
      calcCharge: 900,
    });
  });

  it("uses the matching usage-type and floor price", async () => {
    await expect(saveAndRead("201", "water", "110")).resolves.toEqual({
      usage: 10,
      unitPrice: 80,
      calcCharge: 800,
    });
  });

  it("uses the usage-type default when floor is null on the price", async () => {
    await expect(saveAndRead("302", "water", "110")).resolves.toEqual({
      usage: 10,
      unitPrice: 60,
      calcCharge: 600,
    });
  });

  it("falls back to the building's single customer-number price", async () => {
    await expect(saveAndRead("401", "gas", "110")).resolves.toEqual({
      usage: 10,
      unitPrice: 40,
      calcCharge: 400,
    });
  });

  it("snapshots null price and charge when no price matches", async () => {
    await expect(saveAndRead("501", "elec", "110")).resolves.toEqual({
      usage: 10,
      unitPrice: null,
      calcCharge: null,
    });
  });

  it("uses fixed_usage and ignores the current-minus-previous difference", async () => {
    await expect(saveAndRead("601", "water", "999")).resolves.toEqual({
      usage: 7,
      unitPrice: 90,
      calcCharge: 630,
    });
  });
});
