import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,AAAA"),
  },
}));

import { QRCode } from "./QRCode";

describe("QRCode", () => {
  it("value로 생성한 QR 이미지를 표시한다", async () => {
    render(<QRCode value="bill:1:2026-08-01" />);

    expect(await screen.findByAltText("QR코드")).toHaveAttribute(
      "src",
      "data:image/png;base64,AAAA",
    );
  });
});
