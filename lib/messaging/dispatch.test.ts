import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./ncp", () => ({
  isNcpConfigured: vi.fn(),
  sendSmsViaNcp: vi.fn(),
}));
vi.mock("./alimtalk", () => ({
  isAlimtalkConfigured: vi.fn(),
  sendAlimtalkViaNcp: vi.fn(),
}));

import { anyChannelConfigured, dispatchOne } from "./dispatch";
import { isNcpConfigured, sendSmsViaNcp } from "./ncp";
import { isAlimtalkConfigured, sendAlimtalkViaNcp } from "./alimtalk";

afterEach(() => vi.clearAllMocks());

describe("anyChannelConfigured", () => {
  it("sms: NCP 설정 여부를 따른다", () => {
    vi.mocked(isNcpConfigured).mockReturnValue(true);
    vi.mocked(isAlimtalkConfigured).mockReturnValue(false);
    expect(anyChannelConfigured("sms")).toBe(true);
  });
  it("alimtalk: 알림톡 설정 여부를 따른다", () => {
    vi.mocked(isNcpConfigured).mockReturnValue(false);
    vi.mocked(isAlimtalkConfigured).mockReturnValue(false);
    expect(anyChannelConfigured("alimtalk")).toBe(false);
  });
  it("auto: 둘 중 하나라도 설정되면 true", () => {
    vi.mocked(isNcpConfigured).mockReturnValue(false);
    vi.mocked(isAlimtalkConfigured).mockReturnValue(true);
    expect(anyChannelConfigured("auto")).toBe(true);
  });
});

describe("dispatchOne", () => {
  it("sms 설정+성공 → success", async () => {
    vi.mocked(isNcpConfigured).mockReturnValue(true);
    vi.mocked(sendSmsViaNcp).mockResolvedValue({ requestId: "r1", statusCode: "202", ok: true });
    const r = await dispatchOne({ channel: "sms", phone: "01012345678", body: "hi" });
    expect(r.status).toBe("success");
    expect(r.providerId).toBe("r1");
    expect(sendSmsViaNcp).toHaveBeenCalledWith({ to: "01012345678", content: "hi" });
  });

  it("sms 미설정 → failed(unconfigured), 어댑터 미호출", async () => {
    vi.mocked(isNcpConfigured).mockReturnValue(false);
    const r = await dispatchOne({ channel: "sms", phone: "01012345678", body: "hi" });
    expect(r).toMatchObject({ status: "failed", reason: "unconfigured" });
    expect(sendSmsViaNcp).not.toHaveBeenCalled();
  });

  it("alimtalk 설정+성공 → success(templateCode·buttons 전달)", async () => {
    vi.mocked(isAlimtalkConfigured).mockReturnValue(true);
    vi.mocked(sendAlimtalkViaNcp).mockResolvedValue({ requestId: "a1", statusCode: "202", ok: true });
    const r = await dispatchOne({
      channel: "alimtalk", phone: "01012345678", body: "안녕",
      templateCode: "T1", buttons: [{ name: "확인", type: "WL", url: "https://x" }],
    });
    expect(r.status).toBe("success");
    expect(sendAlimtalkViaNcp).toHaveBeenCalledWith({
      to: "01012345678", templateCode: "T1", content: "안녕",
      buttons: [{ name: "확인", type: "WL", url: "https://x" }],
    });
  });

  it("alimtalk 미설정 → failed(unconfigured)", async () => {
    vi.mocked(isAlimtalkConfigured).mockReturnValue(false);
    const r = await dispatchOne({ channel: "alimtalk", phone: "01012345678", body: "hi", templateCode: "T1" });
    expect(r).toMatchObject({ status: "failed", reason: "unconfigured" });
  });

  it("alimtalk 설정+템플릿코드 없음 → failed(no_template_code)", async () => {
    vi.mocked(isAlimtalkConfigured).mockReturnValue(true);
    const r = await dispatchOne({ channel: "alimtalk", phone: "01012345678", body: "hi" });
    expect(r).toMatchObject({ status: "failed", reason: "no_template_code" });
    expect(sendAlimtalkViaNcp).not.toHaveBeenCalled();
  });

  it("어댑터 예외 → failed(reason 포함)", async () => {
    vi.mocked(isNcpConfigured).mockReturnValue(true);
    vi.mocked(sendSmsViaNcp).mockRejectedValue(new Error("network down"));
    const r = await dispatchOne({ channel: "sms", phone: "01012345678", body: "hi" });
    expect(r.status).toBe("failed");
    expect(r.reason).toContain("network down");
  });

  it("어댑터 ok:false → failed", async () => {
    vi.mocked(isNcpConfigured).mockReturnValue(true);
    vi.mocked(sendSmsViaNcp).mockResolvedValue({ requestId: null, statusCode: "400", ok: false });
    const r = await dispatchOne({ channel: "sms", phone: "01012345678", body: "hi" });
    expect(r.status).toBe("failed");
  });
});
