"use client";

import { useState } from "react";
import { useMessageLogs } from "@/hooks/reactquery/messaging";
import { useScheduledMessages } from "@/hooks/reactquery/messaging";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates";
import { HistoryTab } from "./HistoryTab";
import { ScheduledTab } from "./ScheduledTab";
import { TemplatesTab } from "./TemplatesTab";

export type MessagingTab = "scheduled" | "history" | "templates";

export function MessagingTabs({ initialTab }: { initialTab: MessagingTab }) {
  const [tab, setTab] = useState<MessagingTab>(initialTab);
  const { data: scheduled = [] } = useScheduledMessages();
  const { data: logs = [] } = useMessageLogs();
  const { data: templates = [] } = useMessageTemplates();

  const tabs: { id: MessagingTab; label: string; count: number }[] = [
    { id: "scheduled", label: "예약 발송", count: scheduled.length },
    { id: "history", label: "발송 내역", count: logs.length },
    { id: "templates", label: "템플릿 관리", count: templates.length },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <div className="border-b border-[#e8ebee] bg-white px-[24px]">
        <div role="tablist" aria-label="메시징 메뉴" className="flex gap-[4px]">
          {tabs.map((item) => (
            <button
              key={item.id}
              id={`messaging-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`messaging-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              className={`border-b-2 px-[16px] py-[12px] text-[14px] font-bold transition-colors ${
                tab === item.id
                  ? "border-[#14a497] text-[#14a497]"
                  : "border-transparent text-[#8b95a1] hover:text-t1"
              }`}
            >
              {item.label}
              <span className="ml-[4px] text-[#b0b8c1]">{item.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        id={`messaging-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`messaging-tab-${tab}`}
        className="flex-1 bg-[#f2f4f6] px-[24px] pb-[30px] pt-[22px]"
      >
        {tab === "scheduled" && <ScheduledTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "templates" && <TemplatesTab />}
      </div>
    </div>
  );
}
