"use client";

import { useState } from "react";
import { HistoryTab } from "./HistoryTab";
import { MessagingComposer } from "./MessagingComposer";
import { TemplatesTab } from "./TemplatesTab";

export type MessagingTab = "send" | "templates" | "history";

const TABS: { id: MessagingTab; label: string }[] = [
  { id: "send", label: "발송" },
  { id: "templates", label: "템플릿" },
  { id: "history", label: "내역" },
];

export function MessagingTabs({ initialTab }: { initialTab: MessagingTab }) {
  const [tab, setTab] = useState<MessagingTab>(initialTab);

  return (
    <>
      <div
        role="tablist"
        aria-label="메시징 메뉴"
        className="flex border-b border-line"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            id={`messaging-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`messaging-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            className={`px-5 py-3 text-sm font-bold ${
              tab === item.id
                ? "border-b-2 border-brand text-brand"
                : "text-t3 hover:text-t1"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id={`messaging-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`messaging-tab-${tab}`}
      >
        {tab === "send" && <MessagingComposer initialMode="auto" />}
        {tab === "templates" && <TemplatesTab />}
        {tab === "history" && <HistoryTab />}
      </div>
    </>
  );
}
