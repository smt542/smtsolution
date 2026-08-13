import { describe, expect, it } from "vitest";
import type { SetupConfig } from "@/hooks/reactquery/setupConfig/apis";
import { buildBillDocument } from "./billDoc";
import type { BillingColumn, BillingUnitRow } from "./pivot";

const columns: BillingColumn[] = [
  {
    feeItemId: 10,
    name: "관리비",
    carryOver: false,
    dailyProration: false,
    rounding: "raw",
    isRequired: true,
    sortOrder: 0,
  },
  {
    feeItemId: 11,
    name: "장기수선충당금",
    carryOver: false,
    dailyProration: false,
    rounding: "raw",
    isRequired: false,
    sortOrder: 1,
  },
];

const unit: BillingUnitRow = {
  unitId: 1,
  unitNo: "101",
  dong: null,
  roomTypeLabel: null,
  occupancyId: 5,
  tenantName: "홍길동",
  moveInDate: "2026-07-01",
  isVacant: false,
  confirmedAt: "2026-08-13T00:00:00Z",
  confirmedByName: "관리자",
  totalAmount: 35_000,
  billingNote: null,
  unitNotice: null,
  isDirty: false,
  charges: {
    10: { charged: true, amount: 30_000 },
    11: { charged: true, amount: 5_000 },
  },
};

const config = {
  mgmtBank1: "국민",
  mgmtAcct1: "123",
  mgmtHolder1: "관리단",
  mgmtPrint1: true,
  mgmtBank2: "신한",
  mgmtAcct2: "456",
  mgmtHolder2: "관리단",
  mgmtPrint2: false,
} as SetupConfig;

describe("buildBillDocument", () => {
  it("부과된 항목과 확정 합계를 문서로 만든다", () => {
    const doc = buildBillDocument(unit, columns, config, "2026-08-01", {
      labelMode: "name",
    });

    expect(doc.lines).toEqual([
      { name: "관리비", amount: 30_000 },
      { name: "장기수선충당금", amount: 5_000 },
    ]);
    expect(doc.total).toBe(35_000);
  });

  it("표시 방식에 따라 입주자명 또는 호실 코드를 제목으로 쓴다", () => {
    expect(
      buildBillDocument(unit, columns, config, "2026-08-01", { labelMode: "code" }).title,
    ).toBe("101");
    expect(
      buildBillDocument(unit, columns, config, "2026-08-01", { labelMode: "name" }).title,
    ).toBe("홍길동");
  });

  it("출력 설정이 켜지고 필수 값이 있는 관리비 계좌만 포함한다", () => {
    const doc = buildBillDocument(unit, columns, config, "2026-08-01", {
      labelMode: "name",
    });

    expect(doc.accounts).toEqual([{ bank: "국민", acct: "123", holder: "관리단" }]);
  });

  it("미부과 항목은 제외하고 확정 합계가 없으면 실제 부과선으로 계산한다", () => {
    const unconfirmedTotal = {
      ...unit,
      totalAmount: null,
      charges: {
        10: { charged: true, amount: 30_000 },
        11: { charged: false, amount: 5_000 },
      },
    };

    const doc = buildBillDocument(unconfirmedTotal, columns, null, "2026-08-01", {
      labelMode: "name",
      dueDate: "2026-08-25",
      showCutoff: true,
    });

    expect(doc.lines).toEqual([{ name: "관리비", amount: 30_000 }]);
    expect(doc.total).toBe(30_000);
    expect(doc.accounts).toEqual([]);
    expect(doc.dueDate).toBe("2026-08-25");
    expect(doc.showCutoff).toBe(true);
  });
});
