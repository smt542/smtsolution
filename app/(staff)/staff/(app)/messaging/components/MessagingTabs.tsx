"use client";

import { useState } from "react";
import { Spinner } from "@/components/common";
import { useIsHydrated } from "@/hooks/common";
import { useMessageLogs } from "@/hooks/reactquery/messaging";
import { useScheduledMessages } from "@/hooks/reactquery/messaging";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates";
import { HistoryTab } from "./HistoryTab";
import { ScheduledTab } from "./ScheduledTab";
import { TemplatesTab } from "./TemplatesTab";

export type MessagingTab = "scheduled" | "history" | "templates";

const loadingLabels: Record<MessagingTab, string> = {
  scheduled: "예약 발송 목록 불러오는 중",
  history: "발송 내역 불러오는 중",
  templates: "템플릿 목록 불러오는 중",
};

function MessagingTabLoading({ tab }: { tab: MessagingTab }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-[16px] bg-white shadow-[0px_1px_3px_0px_rgba(23,31,40,0.05)]">
      <Spinner label={loadingLabels[tab]} showLabel />
    </div>
  );
}

export function MessagingTabs({ initialTab }: { initialTab: MessagingTab }) {
  const [tab, setTab] = useState<MessagingTab>(initialTab);
  const { data: scheduled = [] } = useScheduledMessages();
  const { data: logs = [] } = useMessageLogs();
  const { data: templates = [] } = useMessageTemplates();
  const isHydrated = useIsHydrated();

  const tabs: { id: MessagingTab; label: string; count: number }[] = [
    { id: "scheduled", label: "예약 발송", count: isHydrated ? scheduled.length : 0 },
    { id: "history", label: "발송 내역", count: isHydrated ? logs.length : 0 },
    { id: "templates", label: "템플릿 관리", count: isHydrated ? templates.length : 0 },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[#e8ebee] bg-white px-[24px]">
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
        className="flex min-h-0 flex-1 flex-col bg-[#f2f4f6] px-[24px] pb-[30px] pt-[22px]"
      >
        {!isHydrated ? <MessagingTabLoading tab={tab} /> : null}
        {isHydrated && tab === "scheduled" ? <ScheduledTab /> : null}
        {isHydrated && tab === "history" ? <HistoryTab /> : null}
        {isHydrated && tab === "templates" ? <TemplatesTab /> : null}
      </div>
    </div>
  );
}
