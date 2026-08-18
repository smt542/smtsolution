import { describe, expect, it } from "vitest";
import type { OverdueHousehold } from "@/hooks/reactquery/overdue";
import {
  createOverdueLedgerCsv,
  isDebtCollectionTarget,
  overdueLedgerFilename,
} from "./utils";

const household = {
  occupancyId: 1,
  buildingId: 1,
  buildingName: "그린,빌라",
  buildingAddress: "서울",
  unitId: 11,
  unitNo: "101호",
  dong: "A동",
  areaPyeong: 15,
  roomCount: 2,
  tenantName: "김입주",
  payerName: "김입주",
  phone: "010-0000-0000",
  residentCount: 2,
  vehicleNo: null,
  moveInDate: "2025-01-01",
  moveOutDate: null,
  status: "occupied",
  memo: null,
  unitMemo: null,
  overdueMonths: 3,
  overdueAmount: 100_000,
  lastPaymentDate: "2026-04-30",
  billingAvailable: true,
} satisfies OverdueHousehold;

describe("overdue utils", () => {
  it("채권 대상은 2개월 이상 AND 10만원 이상이어야 한다", () => {
    expect(isDebtCollectionTarget(household)).toBe(true);
    expect(isDebtCollectionTarget({ ...household, overdueMonths: 2 })).toBe(true);
    expect(isDebtCollectionTarget({ ...household, overdueMonths: 1 })).toBe(false);
    expect(isDebtCollectionTarget({ ...household, overdueAmount: 99_999 })).toBe(false);
  });

  it("현재 조회 결과를 엑셀 호환 CSV로 직렬화한다", () => {
    const csv = createOverdueLedgerCsv([household]);
    expect(csv).toContain("건물명,호실명,입주자명");
    expect(csv).toContain('"그린,빌라",A동 101호,김입주');
    expect(csv).toContain("3,100000,0,2026-04-30,확정 부과 있음");
  });

  it("CSV 헤더와 본문에 연체료를 포함한다", () => {
    const csv = createOverdueLedgerCsv([
      { ...household, lateFeeAmount: 3_400 },
    ]);

    expect(csv).toContain("연체료");
    expect(csv).toContain("100000,3400,2026-04-30");
  });

  it("건물명과 조회 월로 안전한 파일명을 만든다", () => {
    expect(overdueLedgerFilename("그린/빌라", new Date(2026, 7, 12)))
      .toBe("그린_빌라_미납대장_202608.csv");
  });
});

