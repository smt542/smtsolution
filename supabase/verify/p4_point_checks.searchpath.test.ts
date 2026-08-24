import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "p4_point_checks.sql"), "utf8");

/**
 * PostgreSQL은 `SET search_path = ''`(빈 문자열)를 pg_proc.proconfig에 **따옴표 씌운 빈 문자열**
 * `search_path=""`로 저장한다. search_path는 GUC_LIST_QUOTE라 각 요소가 quote_identifier되고,
 * 빈 문자열은 유효한 식별자가 아니라 `""`로 인용된다. 따라서 정확 일치 `'search_path=' = any(proconfig)`
 * 검사는 하드닝된(빈 search_path 고정) 함수에서도 항상 거짓이 되어 오탐(false failure)한다.
 *
 * 아래 predicate는 verify SQL이 써야 할 견고한 검사의 진리표를 문서화한다:
 * 따옴표 유무에 관계없이 빈 search_path 고정을 인정하고, search_path가 아예 없으면 실패한다.
 */
function searchPathFixedToEmpty(proconfig: string[] | null): boolean {
  const cfg = proconfig ?? [];
  return cfg.includes('search_path=""') || cfg.includes("search_path=");
}

describe("p4_point_checks search_path proconfig 검증 로직", () => {
  it("PG가 실제로 저장하는 따옴표 빈 문자열 표현(search_path=\"\")을 인정한다(하드닝 통과)", () => {
    expect(searchPathFixedToEmpty(['search_path=""'])).toBe(true);
    expect(searchPathFixedToEmpty(["search_path=", "role=postgres"])).toBe(true);
  });

  it("search_path가 아예 없으면 실패한다(missing)", () => {
    expect(searchPathFixedToEmpty(null)).toBe(false);
    expect(searchPathFixedToEmpty([])).toBe(false);
    expect(searchPathFixedToEmpty(["role=postgres"])).toBe(false);
  });
});

describe("p4_point_checks.sql search_path 정적 assert", () => {
  it("따옴표 빈 문자열에서 오탐하는 정확 일치 any() 검사를 쓰지 않는다", () => {
    expect(sql).not.toMatch(/'search_path=' = any\(/);
  });

  it("PG가 저장하는 따옴표 빈 문자열 표현(search_path=\"\")을 인정하는 견고한 검사를 쓴다", () => {
    expect(sql).toContain('search_path=""');
  });
});
