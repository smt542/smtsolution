import { beforeEach, describe, expect, it, vi } from "vitest";

const invalidateQueries = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
  useMutation: (options: unknown) => options,
}));
vi.mock("./apis", () => ({
  saveBillingCharges: vi.fn(),
  confirmBilling: vi.fn(),
  chargeNewOccupancies: vi.fn(),
  saveBillingPeriodSetting: vi.fn(),
  copyPreviousBilling: vi.fn(),
}));

import { billingKeys } from "./keys";
import {
  useChargeNewOccupancies,
  useConfirmBilling,
  useSaveBillingCharges,
  useCopyPreviousBilling,
} from "./mutations";

beforeEach(() => vi.clearAllMocks());

describe("billing mutation invalidation", () => {
  it("draft save invalidates only the edited building and period list", () => {
    const input = {
      buildingId: 7,
      period: "2026-08-01",
      charges: [],
      notes: [],
    };
    const mutation = useSaveBillingCharges() as unknown as {
      onSuccess: (result: void, variables: typeof input) => void;
    };

    mutation.onSuccess(undefined, input);

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: billingKeys.list(7, "2026-08-01"),
    });
  });

  it("confirmation invalidates its list, new-occupancy result, and billing histories", () => {
    const input = { buildingId: 7, period: "2026-08-01" };
    const mutation = useConfirmBilling() as unknown as {
      onSuccess: (result: { unitCount: number; total: number }, variables: typeof input) => void;
    };

    mutation.onSuccess({ unitCount: 2, total: 60000 }, input);

    expect(invalidateQueries.mock.calls).toEqual([
      [{ queryKey: billingKeys.list(7, "2026-08-01") }],
      [{ queryKey: billingKeys.histories() }],
      [{ queryKey: billingKeys.newOccupancies(7, "2026-08-01") }],
    ]);
  });

  it("new-occupancy charge invalidates only its period and affected unit histories", () => {
    const input = { buildingId: 7, period: "2026-08-01", unitIds: [3, 4] };
    const mutation = useChargeNewOccupancies() as unknown as {
      onSuccess: (result: { unitCount: number; total: number }, variables: typeof input) => void;
    };

    mutation.onSuccess({ unitCount: 2, total: 60000 }, input);

    expect(invalidateQueries.mock.calls).toEqual([
      [{ queryKey: billingKeys.list(7, "2026-08-01") }],
      [{ queryKey: billingKeys.newOccupancies(7, "2026-08-01") }],
      [{ queryKey: billingKeys.history(3, "2026-08-01") }],
      [{ queryKey: billingKeys.history(4, "2026-08-01") }],
    ]);
  });

  it("전월자료 반영은 요청한 모든 건물의 현재 월 목록을 무효화한다", () => {
    const input = { buildingIds: [7, 8], period: "2026-08-01" };
    const mutation = useCopyPreviousBilling() as unknown as {
      onSuccess: (result: unknown, variables: typeof input) => void;
    };
    mutation.onSuccess({}, input);
    expect(invalidateQueries.mock.calls).toEqual([
      [{ queryKey: billingKeys.list(7, "2026-08-01") }],
      [{ queryKey: billingKeys.periodSetting(7, "2026-08-01") }],
      [{ queryKey: billingKeys.list(8, "2026-08-01") }],
      [{ queryKey: billingKeys.periodSetting(8, "2026-08-01") }],
    ]);
  });
});
