import { afterEach, describe, expect, it, vi } from "vitest";

const getMessages = vi.fn();
const kakaoGetMessages = vi.fn();
const getMessagesRN = vi.fn();
const kakaoGetMessagesRN = vi.fn();
const getFaxResult = vi.fn();
vi.mock("./sdk", () => ({
  getMessageService: () => ({ getMessages, getMessagesRN }),
  getKakaoService: () => ({ getMessages: kakaoGetMessages, getMessagesRN: kakaoGetMessagesRN }),
  getFaxService: () => ({ getFaxResult }),
}));

import {
  computeNextPollAt,
  fetchFaxResult,
  fetchMessageResults,
  fetchMessageResultsByRequestNum,
  normalizeFaxResult,
  normalizeMessageResult,
} from "./results";
import type { PopbillConfig } from "./config";

const config: PopbillConfig = {
  linkId: "L",
  secretKey: "SECRET",
  corpNum: "1234567890",
  userId: "u",
  isTest: true,
  ipRestrictOn: true,
  useStaticIp: false,
  useLocalTime: true,
  smsSender: "0212345678",
  kakaoSender: "@ch",
  faxSender: "0311112222",
};

afterEach(() => vi.clearAllMocks());

describe("normalizeMessageResult", () => {
  it("state=3/result=100은 성공", () => {
    expect(normalizeMessageResult(3, 100)).toBe("success");
  });
  it("state=3의 다른 결과·알 수 없는 코드는 실패(terminal)", () => {
    expect(normalizeMessageResult(3, 1001)).toBe("failed");
    expect(normalizeMessageResult(3, 0)).toBe("failed");
  });
  it("state<3은 대기(pending)", () => {
    expect(normalizeMessageResult(0, 0)).toBe("pending");
    expect(normalizeMessageResult(2, 1)).toBe("pending");
  });
  it("취소 등 state>3은 실패(terminal)", () => {
    expect(normalizeMessageResult(4, 0)).toBe("failed");
  });
});

describe("computeNextPollAt", () => {
  const base = new Date("2026-08-24T00:00:00.000Z");
  it("최초 10분 이내는 1분 후", () => {
    const now = new Date(base.getTime() + 3 * 60_000);
    expect(computeNextPollAt(base, now)?.getTime()).toBe(now.getTime() + 60_000);
  });
  it("2시간까지는 5분 후", () => {
    const now = new Date(base.getTime() + 30 * 60_000);
    expect(computeNextPollAt(base, now)?.getTime()).toBe(now.getTime() + 5 * 60_000);
  });
  it("24시간까지는 30분 후", () => {
    const now = new Date(base.getTime() + 5 * 3_600_000);
    expect(computeNextPollAt(base, now)?.getTime()).toBe(now.getTime() + 30 * 60_000);
  });
  it("24시간 초과는 null(reconcile_required)", () => {
    const now = new Date(base.getTime() + 25 * 3_600_000);
    expect(computeNextPollAt(base, now)).toBeNull();
  });
});

describe("fetchMessageResults", () => {
  it("문자 결과를 interOPRefKey→상태로 매핑한다", async () => {
    getMessages.mockImplementation((...args: unknown[]) => {
      (args[3] as (r: unknown[]) => void)([
        { state: 3, result: 100, interOPRefKey: "r0" },
        { state: 2, result: 1, interOPRefKey: "r1" },
        { state: 3, result: 1001, interOPRefKey: "r2" },
        { state: 3, result: 100 }, // interOPRefKey 없음 → 제외
      ]);
    });
    const out = await fetchMessageResults(config, "sms", "RCPT-1");
    expect(out).toEqual([
      { providerRefKey: "r0", status: "success", code: "100" },
      { providerRefKey: "r1", status: "pending", code: "1" },
      { providerRefKey: "r2", status: "failed", code: "1001" },
    ]);
    expect(getMessages).toHaveBeenCalledWith("1234567890", "RCPT-1", "u", expect.any(Function), expect.any(Function));
  });

  it("알림톡은 KakaoService.getMessages를 사용한다", async () => {
    kakaoGetMessages.mockImplementation((...args: unknown[]) => {
      (args[3] as (r: unknown[]) => void)([{ state: 3, result: 100, interOPRefKey: "a0" }]);
    });
    const out = await fetchMessageResults(config, "alimtalk", "RCPT-A");
    expect(out).toEqual([{ providerRefKey: "a0", status: "success", code: "100" }]);
    expect(kakaoGetMessages).toHaveBeenCalled();
  });

  it("조회 오류는 비밀값 없이 reject된다", async () => {
    getMessages.mockImplementation((...args: unknown[]) => {
      (args[4] as (e: { code: number; message: string }) => void)({ code: -99, message: "err" });
    });
    const err = (await fetchMessageResults(config, "sms", "X").catch((e) => e)) as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).not.toContain("SECRET");
  });
});

describe("fetchMessageResultsByRequestNum", () => {
  it("receipt가 없는 문자 접수를 RequestNum으로 조회한다", async () => {
    getMessagesRN.mockImplementation((...args: unknown[]) => {
      (args[3] as (rows: unknown[]) => void)([
        { state: 2, result: 1, interOPRefKey: "r0" },
      ]);
    });

    const out = await fetchMessageResultsByRequestNum(config, "sms", "m77c0");

    expect(out).toEqual([{ providerRefKey: "r0", status: "pending", code: "1" }]);
    expect(getMessagesRN).toHaveBeenCalledWith(
      "1234567890",
      "m77c0",
      "u",
      expect.any(Function),
      expect.any(Function),
    );
  });
});

describe("normalizeFaxResult", () => {
  it("state=3/성공 페이지만 있으면 success + 페이지 집계", () => {
    const r = normalizeFaxResult([
      { state: 3, result: 100, sendPageCnt: 2, successPageCnt: 2, failPageCnt: 0, chargePageCnt: 2, refundPageCnt: 0 },
    ]);
    expect(r).toMatchObject({ status: "success", sendPages: 2, successPages: 2, failPages: 0, chargePages: 2, refundPages: 0 });
  });
  it("성공·실패 페이지가 섞이면 partial", () => {
    const r = normalizeFaxResult([
      { state: 3, result: 517, sendPageCnt: 3, successPageCnt: 2, failPageCnt: 1, chargePageCnt: 2, refundPageCnt: 1 },
    ]);
    expect(r.status).toBe("partial");
    expect(r.successPages).toBe(2);
    expect(r.refundPages).toBe(1);
  });
  it("성공 페이지가 없으면 failed(코드 506 등)", () => {
    const r = normalizeFaxResult([{ state: 3, result: 506, sendPageCnt: 1, successPageCnt: 0, failPageCnt: 1 }]);
    expect(r.status).toBe("failed");
    expect(r.code).toBe("506");
  });
  it("state<3 또는 빈 결과는 pending", () => {
    expect(normalizeFaxResult([{ state: 1, result: 1 }]).status).toBe("pending");
    expect(normalizeFaxResult([]).status).toBe("pending");
  });
});

describe("fetchFaxResult", () => {
  it("getFaxResult 응답을 집계한다", async () => {
    getFaxResult.mockImplementation((...args: unknown[]) => {
      (args[3] as (r: unknown[]) => void)([
        { state: 3, result: 100, sendPageCnt: 1, successPageCnt: 1, failPageCnt: 0, chargePageCnt: 1, refundPageCnt: 0 },
      ]);
    });
    const out = await fetchFaxResult(config, "FAX-1");
    expect(out).toMatchObject({ status: "success", successPages: 1 });
    expect(getFaxResult).toHaveBeenCalledWith("1234567890", "FAX-1", "u", expect.any(Function), expect.any(Function));
  });
});
