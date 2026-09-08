import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { QrCode } from "./QrCode";

describe("QrCode", () => {
  it("value로 svg를 렌더한다", () => {
    const { container } = render(<QrCode value="https://x.io/a?unit=1" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
