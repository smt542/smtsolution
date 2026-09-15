import { describe, expect, it } from "vitest";
import type { BuildingFull } from "@/hooks/reactquery/buildings";
import { emptyFacilities } from "@/hooks/reactquery/buildings";
import { buildingToFormState, formStateToPayload, initialFormState } from "./formState";

const saveOptions = {
  id: null,
  resolveStaffId: () => null,
  resolveTypeId: () => null,
  carry: { cleaningUserId: null, facilities: emptyFacilities() },
};

function building(overrides: Partial<BuildingFull> = {}): BuildingFull {
  return {
    id: 7,
    orgId: 1,
    code: "B0007",
    name: "해오름",
    address: "서울",
    typeId: null,
    ownerName: null,
    ownerPhone: null,
    entrancePassword: null,
    managerUserId: null,
    meterUserId: null,
    cleaningUserId: null,
    facilities: emptyFacilities(),
    memo: null,
    billingNote: null,
    setupConfirmRequired: false,
    customerNumbers: [],
    vendors: [],
    ...overrides,
  };
}

describe("building register normalized mapping", () => {
  it("maps redesigned utility and vendor fields to save_building normalized arrays", () => {
    const state = initialFormState();
    state.name = "새 빌딩";
    state.utilities.water.cards = [{
      fields: {
        고객번호: " W-100 ",
        성명: "홍길동",
        월분: "전월",
        계산: "수동",
        조회: "LIN-1",
        검침일: "15일",
        "고지기간 출력": "N",
        메모: "수도 적요",
        입금: "국민 123",
        계산법: "인원",
      },
    }];
    state.utilities.gas.extra = { 가스회사: "도시가스" };
    state.vendors.elevator_insp = {
      fields: { 업체명: "한국승강기", 전화번호: "02-1234", 계좌번호: "111-22", 검사일: "2026-09-01" },
      memo: "정기 검사",
      pendingFiles: [],
    };

    const payload = formStateToPayload(state, saveOptions);

    expect(payload.customerNumbers).toEqual([{
      id: undefined,
      kind: "water",
      customerNo: "W-100",
      meterDay: 15,
      billingBasis: "prev",
      printOnBill: false,
      holderName: "홍길동",
      lineName: "LIN-1",
      calculationMethod: "manual",
      note: "수도 적요",
      sortOrder: 0,
    }]);
    expect(payload.vendors).toEqual([{
      id: undefined,
      clientKey: "register-elevator_insp",
      vendorType: "elevator",
      name: "한국승강기",
      phone: "02-1234",
      memo: "정기 검사",
      sortOrder: 6,
    }]);

    expect(payload.extraInfo).toEqual({
      utilities: {
        water: { cards: [{ 입금: "국민 123", 계산법: "인원" }], extra: {} },
        gas: { cards: [{}], extra: { 가스회사: "도시가스" } },
      },
    });
    expect(payload.vendorDetails).toEqual({
      vendors: {
        elevator_insp: { fields: { 계좌번호: "111-22", 검사일: "2026-09-01" }, assigned: true },
      },
    });
  });

  it("hydrates normalized rows for editing and preserves their ids on update", () => {
    const state = buildingToFormState(building({
      extraInfo: { utilities: { water: { cards: [{ 입금: "자동이체" }], extra: {} } } },
      vendorDetails: { vendors: { elevator_insp: { fields: { 검사일: "2026-08-10" }, assigned: true } } },
      customerNumbers: [
        {
          id: 11,
          buildingId: 7,
          kind: "water",
          customerNo: "W-OLD",
          meterDay: 7,
          billingBasis: "current",
          printOnBill: true,
          holderName: "기존 명의",
          lineName: "A",
          calculationMethod: "manual",
          note: "기존 적요",
          sortOrder: 0,
        },
        {
          id: 12,
          buildingId: 7,
          kind: "common_elec",
          customerNo: "E-COMMON",
          meterDay: 9,
          billingBasis: "prev",
          printOnBill: false,
          holderName: "공용 계약",
          lineName: null,
          calculationMethod: "auto",
          note: null,
          sortOrder: 1,
        },
      ],
      vendors: [{
        id: 21,
        buildingId: 7,
        vendorType: "elevator",
        name: "승강기 검사원",
        phone: "02-999",
        memo: "기존 메모",
        sortOrder: 0,
      }],
    }), () => "", () => "");

    expect(state.utilities.water.cards[0]).toMatchObject({
      fields: { 고객번호: "W-OLD", 검침일: "7일", 계산: "수동", 입금: "자동이체" },
      normalized: { id: 11 },
    });
    expect(state.vendors.elevator_insp).toMatchObject({
      fields: { 업체명: "승강기 검사원", 전화번호: "02-999", 검사일: "2026-08-10" },
      memo: "기존 메모",
      normalized: { id: 21 },
    });

    state.utilities.water.cards[0].fields.고객번호 = "W-UPDATED";
    state.vendors.elevator_insp.fields.업체명 = "승강기 검사원 변경";
    const payload = formStateToPayload(state, { ...saveOptions, id: 7 });

    expect(payload.customerNumbers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 11, kind: "water", customerNo: "W-UPDATED" }),
      expect.objectContaining({ id: 12, kind: "common_elec", customerNo: "E-COMMON", printOnBill: false }),
    ]));
    expect(payload.vendors).toContainEqual(expect.objectContaining({
      id: 21,
      vendorType: "elevator",
      name: "승강기 검사원 변경",
    }));
  });

  it("promotes legacy JSON-only entries and emits deletions for removed normalized rows", () => {
    const state = buildingToFormState(building({
      extraInfo: {
        utilities: {
          elec: {
            cards: [{ 고객번호: "E-LEGACY", 계약명: "레거시", 월분: "당월", 검침일: "20일", 입금: "수기" }],
            extra: {},
          },
        },
      },
      vendorDetails: {
        vendors: {
          cleaning: { fields: { 업체명: "청소회사", 전화번호: "010-1", "청소 횟수": "주 1회" }, memo: "레거시" },
        },
      },
      customerNumbers: [{
        id: 31,
        buildingId: 7,
        kind: "gas",
        customerNo: "G-REMOVE",
        meterDay: null,
        billingBasis: "current",
        printOnBill: true,
        holderName: null,
        lineName: null,
        calculationMethod: "auto",
        note: null,
        sortOrder: 0,
      }],
    }), () => "", () => "");
    state.utilities.gas.cards = [];
    state.utilities.gas.deletedIds = [31];

    const payload = formStateToPayload(state, { ...saveOptions, id: 7 });

    expect(payload.customerNumbers).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "elec", customerNo: "E-LEGACY", id: undefined }),
      expect.objectContaining({ id: 31, _deleted: true }),
    ]));
    expect(payload.vendors).toContainEqual(expect.objectContaining({
      vendorType: "etc",
      name: "청소회사",
      phone: "010-1",
      memo: "레거시",
    }));
    expect(JSON.stringify(payload.extraInfo)).not.toContain("E-LEGACY");
    expect(JSON.stringify(payload.vendorDetails)).not.toContain("청소회사");
  });
});
