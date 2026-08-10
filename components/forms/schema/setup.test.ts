import { describe, it, expect } from "vitest";
import {
  setupBillingSchema,
  setupSettlementSchema,
  labelMasterSchema,
  quickMessageSchema,
  longTermRepairSchema,
} from "./setup";

describe("setup schemas", () => {
  it("billing: unitLabelDefault enum + cutoffMonths 정수", () => {
    expect(
      setupBillingSchema.safeParse({
        unitLabelDefault: "code",
        lateFeeMerge: false,
        printUtilityCutoff: false,
        printWaterUnitPrice: false,
        printBillingPeriod: false,
        printDelta: false,
        showAsOnMain: false,
      }).success
    ).toBe(true);
    expect(
      setupBillingSchema.safeParse({
        unitLabelDefault: "bad",
        lateFeeMerge: false,
        printUtilityCutoff: false,
        printWaterUnitPrice: false,
        printBillingPeriod: false,
        printDelta: false,
        showAsOnMain: false,
      }).success
    ).toBe(false);
    expect(
      setupBillingSchema.safeParse({
        unitLabelDefault: "code",
        lateFeeMerge: false,
        printUtilityCutoff: false,
        printWaterUnitPrice: false,
        printBillingPeriod: false,
        printDelta: false,
        showAsOnMain: false,
        cutoffMonths: 1.5,
      }).success
    ).toBe(false);
  });
  it("settlement: vacancyPaymentMode enum", () => {
    expect(
      setupSettlementSchema.safeParse({
        waterUnitReflect: true,
        electricUnitReflect: false,
        vacancyPaymentMode: "auto",
      }).success
    ).toBe(true);
    expect(
      setupSettlementSchema.safeParse({
        waterUnitReflect: true,
        electricUnitReflect: false,
        vacancyPaymentMode: "x",
      }).success
    ).toBe(false);
  });
  it("labelMaster: label 필수", () => {
    expect(labelMasterSchema.safeParse({ label: "" }).success).toBe(false);
    expect(labelMasterSchema.safeParse({ label: "원룸" }).success).toBe(true);
  });
  it("quickMessage: title·body 필수", () => {
    expect(quickMessageSchema.safeParse({ title: "", body: "내용" }).success).toBe(
      false
    );
    expect(
      quickMessageSchema.safeParse({ title: "인사", body: "내용" }).success
    ).toBe(true);
  });
  it("longTermRepair: workName 필수, amount 음수 불가", () => {
    expect(longTermRepairSchema.safeParse({ workName: "" }).success).toBe(false);
    expect(
      longTermRepairSchema.safeParse({ workName: "방수공사", amount: -1 }).success
    ).toBe(false);
    expect(
      longTermRepairSchema.safeParse({ workName: "방수공사", amount: 500000 })
        .success
    ).toBe(true);
  });
});
