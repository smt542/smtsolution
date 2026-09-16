import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clientPhase: false,
}));

vi.mock("@/hooks/reactquery/messaging", () => ({
  useScheduledMessages: () => ({
    data: mocks.clientPhase ? Array.from({ length: 7 }, (_, id) => ({ id })) : [],
  }),
  useMessageLogs: () => ({
    data: mocks.clientPhase ? Array.from({ length: 3 }, (_, id) => ({ id })) : [],
  }),
}));

vi.mock("@/hooks/reactquery/messageTemplates", () => ({
  useMessageTemplates: () => ({
    data: mocks.clientPhase ? Array.from({ length: 2 }, (_, id) => ({ id })) : [],
  }),
}));

vi.mock("./ScheduledTab", () => ({ ScheduledTab: () => <div>예약 목록</div> }));
vi.mock("./HistoryTab", () => ({ HistoryTab: () => <div>발송 목록</div> }));
vi.mock("./TemplatesTab", () => ({ TemplatesTab: () => <div>템플릿 목록</div> }));

import { MessagingTabs } from "./MessagingTabs";

let container: HTMLDivElement;

beforeEach(() => {
  mocks.clientPhase = false;
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
});

describe("MessagingTabs hydration", () => {
  it("서버의 빈 쿼리와 브라우저 캐시가 달라도 동일한 첫 화면으로 hydration한다", async () => {
    container.innerHTML = renderToString(<MessagingTabs initialTab="scheduled" />);
    expect(within(container).getByRole("tab", { name: "예약 발송0" })).toBeInTheDocument();

    mocks.clientPhase = true;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;

    await act(async () => {
      root = hydrateRoot(container, <MessagingTabs initialTab="scheduled" />);
    });

    expect(within(container).getByRole("tab", { name: "예약 발송7" })).toBeInTheDocument();
    expect(within(container).getByText("예약 목록")).toBeInTheDocument();
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydration/i);

    await act(async () => root?.unmount());
  });
});
