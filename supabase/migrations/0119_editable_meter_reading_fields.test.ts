import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "0119_editable_meter_reading_fields.sql"), "utf8");

describe("0119 editable meter reading fields", () => {
  it("uses explicitly supplied previous readings and usage values", () => {
    expect(sql).toContain("v_item ? 'previous_reading'");
    expect(sql).toContain("v_item ? 'usage'");
    expect(sql).toContain("previous_reading = excluded.previous_reading");
    expect(sql).toContain("usage = excluded.usage");
  });

  it("keeps the legacy derived-value fallbacks for older clients", () => {
    expect(sql).toContain("period = (p_period - interval '1 month')::date");
    expect(sql).toContain("then v_fixed_usage");
    expect(sql).toContain("then v_cur - v_prev");
  });
});
