import { describe, expect, it } from "vitest";
import { matchDeposits, normalizeName } from "./match";
import type { Deposit } from "./bankParse";

const dep = (o: Partial<Deposit>): Deposit => ({ customerNo: "", name: "", amount: 0, paidAt: null, rowIndex: 0, ...o });
const units = [
  { unitId: 1, unitNo: "101", payerNo: "C-1", payerName: "김납부", tenantName: "김철수", unpaid: 10000 },
  { unitId: 2, unitNo: "102", payerNo: null, payerName: null, tenantName: "이영희", unpaid: 5000 },
  { unitId: 3, unitNo: "103", payerNo: null, payerName: null, tenantName: "이영희", unpaid: 3000 },
];

describe("matchDeposits", () => {
  it("고객번호 정확일치 우선 + 차액", () => {
    const r = matchDeposits([dep({ customerNo: "C-1", name: "아무개", amount: 4000 })], units);
    expect(r.matched[0]).toMatchObject({ unitId: 1, delta: -6000 });
    expect(r.unmatched).toHaveLength(0);
  });
  it("고객번호 미스 → 이름 단일일치", () => {
    const r = matchDeposits([dep({ name: "이 영희", amount: 5000 })], units.slice(1, 2));
    expect(r.matched[0].unitId).toBe(2);
  });
  it("이름 복수후보 → 미매칭", () => {
    const r = matchDeposits([dep({ name: "이영희", amount: 5000 })], units);
    expect(r.matched).toHaveLength(0);
    expect(r.unmatched).toHaveLength(1);
  });
  it("숫자가 다른 이름은 정확히 구분", () => {
    const numberedUnits = [
      { unitId: 4, unitNo: "104", payerNo: null, payerName: "김납부1", tenantName: null, unpaid: 5000 },
      { unitId: 5, unitNo: "105", payerNo: null, payerName: "김납부2", tenantName: null, unpaid: 5000 },
    ];
    const r = matchDeposits([dep({ name: "김납부2", amount: 5000 })], numberedUnits);
    expect(r.matched[0].unitId).toBe(5);
  });
  it("숫자 제거 fallback은 단일 후보일 때만 매칭", () => {
    const single = matchDeposits(
      [dep({ name: "김납부", amount: 5000 })],
      [{ unitId: 4, unitNo: "104", payerNo: null, payerName: "김납부1", tenantName: null, unpaid: 5000 }],
    );
    const collision = matchDeposits(
      [dep({ name: "김납부", amount: 5000 })],
      [
        { unitId: 4, unitNo: "104", payerNo: null, payerName: "김납부1", tenantName: null, unpaid: 5000 },
        { unitId: 5, unitNo: "105", payerNo: null, payerName: "김납부2", tenantName: null, unpaid: 5000 },
      ],
    );
    expect(single.matched[0].unitId).toBe(4);
    expect(collision.matched).toHaveLength(0);
    expect(collision.unmatched).toHaveLength(1);
  });
  it("아무 매칭 없음 → 미매칭", () => {
    const r = matchDeposits([dep({ customerNo: "X", name: "누구", amount: 1 })], units);
    expect(r.unmatched).toHaveLength(1);
  });
  it("unpaid null이면 delta null", () => {
    const r = matchDeposits([dep({ customerNo: "C-9", amount: 1000 })],
      [{ unitId: 9, unitNo: "9", payerNo: "C-9", payerName: null, tenantName: null, unpaid: null }]);
    expect(r.matched[0].delta).toBeNull();
  });
});

describe("normalizeName", () => {
  it("공백·괄호 제거·소문자, 숫자 보존", () => { expect(normalizeName(" 김 철수(101) ")).toBe("김철수101"); });
});
