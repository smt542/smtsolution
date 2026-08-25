import { afterEach, describe, expect, it } from "vitest";

import { residentOrigin } from "./residentOrigin";

const originalResidentWebOrigin =
  process.env.NEXT_PUBLIC_RESIDENT_WEB_ORIGIN;

afterEach(() => {
  if (originalResidentWebOrigin === undefined) {
    delete process.env.NEXT_PUBLIC_RESIDENT_WEB_ORIGIN;
  } else {
    process.env.NEXT_PUBLIC_RESIDENT_WEB_ORIGIN = originalResidentWebOrigin;
  }
});

describe("residentOrigin", () => {
  it("throws a clear error when NEXT_PUBLIC_RESIDENT_WEB_ORIGIN is unset", () => {
    delete process.env.NEXT_PUBLIC_RESIDENT_WEB_ORIGIN;

    expect(() => residentOrigin()).toThrow(
      "NEXT_PUBLIC_RESIDENT_WEB_ORIGIN is not configured",
    );
  });

  it("trims whitespace and trailing slashes", () => {
    process.env.NEXT_PUBLIC_RESIDENT_WEB_ORIGIN =
      "  https://resident.example.com///  ";

    expect(residentOrigin()).toBe("https://resident.example.com");
  });
});
