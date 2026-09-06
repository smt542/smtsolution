import { afterEach, describe, expect, it, vi } from "vitest";

const sendFaxBinary = vi.fn();
const checkSenderNumber = vi.fn((...args: unknown[]) => {
  (args[args.length - 2] as (result: { code: number }) => void)({ code: 1 });
});
vi.mock("./sdk", () => ({ getFaxService: () => ({ sendFaxBinary, checkSenderNumber }) }));

import { submitFax } from "./fax";
import { PopbillTimeoutError } from "./types";
import { PopbillNotConfiguredError, type PopbillConfig } from "./config";

const config: PopbillConfig = {
  linkId: "L",
  secretKey: "TOP_SECRET",
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

const pdf = Buffer.from("%PDF-1.7 test");
const input = {
  requestNum: "f5a0",
  receiver: "02-333-4444",
  receiverName: "홍길동",
  title: "관리비 고지서",
  fileName: "bill-5.pdf",
  pdf,
  providerRefKey: "f5a0",
};

afterEach(() => vi.clearAllMocks());

describe("submitFax", () => {
  it("단일 PDF를 sendFaxBinary로 접수하고 receipt를 반환한다", async () => {
    sendFaxBinary.mockImplementation((...args: unknown[]) => {
      (args[args.length - 2] as (r: string) => void)("FAX-RCPT-1");
    });
    const out = await submitFax(input, config);
    expect(out).toEqual({ requestNum: "f5a0", receiptNum: "FAX-RCPT-1" });
    const [corpNum, options] = sendFaxBinary.mock.calls[0] as [string, Record<string, unknown>];
    expect(corpNum).toBe("1234567890");
    expect(options.SenderNum).toBe("0311112222");
    expect(options.Receiver).toBe("023334444"); // 숫자만
    expect(options.RequestNum).toBe("f5a0");
    expect(options.interOPRefKey).toBe("f5a0");
    const files = options.BinaryFiles as Array<{ fileName: string; fileData: Buffer }>;
    expect(files[0].fileName).toBe("bill-5.pdf");
    expect(files[0].fileData).toBe(pdf);
    expect(options.FilePaths).toBeTruthy(); // SDK 빈값 검사 통과용
  });

  it("공급자 오류는 비밀값 없이 정규화되어 reject된다", async () => {
    sendFaxBinary.mockImplementation((...args: unknown[]) => {
      (args[args.length - 1] as (e: { code: number; message: string }) => void)({ code: 506, message: "발신번호 오류" });
    });
    const err = (await submitFax(input, config).catch((e) => e)) as Error & { code?: string };
    expect(err.code).toBe("506");
    expect(err.message).not.toContain("TOP_SECRET");
  });

  it("팩스 발신번호 미설정이면 PROVIDER_NOT_CONFIGURED", async () => {
    await expect(submitFax(input, { ...config, faxSender: "" })).rejects.toBeInstanceOf(PopbillNotConfiguredError);
    expect(sendFaxBinary).not.toHaveBeenCalled();
  });

  it("등록되지 않은 팩스 발신번호는 provider 접수 전에 거절한다", async () => {
    checkSenderNumber.mockImplementationOnce((...args: unknown[]) => {
      (args[args.length - 2] as (result: { code: number }) => void)({ code: 0 });
    });

    await expect(submitFax(input, config)).rejects.toMatchObject({ code: "SENDER_NOT_REGISTERED" });
    expect(sendFaxBinary).not.toHaveBeenCalled();
  });

  it("공급자 무응답(콜백 없음)은 PopbillTimeoutError로 거절해 무한 대기를 막는다", async () => {
    vi.useFakeTimers();
    try {
      sendFaxBinary.mockImplementation(() => {
        // 성공/오류 콜백 어느 것도 호출하지 않는다(네트워크 침묵).
      });
      const promise = submitFax(input, config, { timeoutMs: 1000 });
      const assertion = expect(promise).rejects.toBeInstanceOf(PopbillTimeoutError);
      await vi.advanceTimersByTimeAsync(1000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("타임아웃 이후 도착한 지연 콜백은 Promise를 이중 정산하지 않는다", async () => {
    vi.useFakeTimers();
    try {
      let lateSuccess: ((r: string) => void) | undefined;
      sendFaxBinary.mockImplementation((...args: unknown[]) => {
        lateSuccess = args[args.length - 2] as (r: string) => void;
      });
      const promise = submitFax(input, config, { timeoutMs: 1000 });
      const assertion = expect(promise).rejects.toBeInstanceOf(PopbillTimeoutError);
      await vi.advanceTimersByTimeAsync(1000);
      lateSuccess?.("LATE-FAX-RCPT");
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });
});
