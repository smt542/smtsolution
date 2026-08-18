"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState, Spinner } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { hasModule } from "@/lib/auth/permissions";
import { HistoryTab } from "./components/HistoryTab";
import { MessagingComposer } from "./components/MessagingComposer";
import { TemplatesTab } from "./components/TemplatesTab";

type MessagingTab = "send" | "templates" | "history";

const TABS: { id: MessagingTab; label: string }[] = [
  { id: "send", label: "발송" },
  { id: "templates", label: "템플릿" },
  { id: "history", label: "내역" },
];

function parseTab(value: string | null): MessagingTab {
  return value === "templates" || value === "history" ? value : "send";
}

export default function MessagingPage() {
  const { data: me, isLoading } = useMe();

  if (isLoading || me === undefined) {
    return (
      <div className="p-6">
        <Spinner />
      </div>
    );
  }

  if (!hasModule(me, "messaging")) {
    return (
      <div className="p-6">
        <EmptyState message="문자 발송 권한이 없습니다." />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="p-6">
          <Spinner />
        </div>
      }
    >
      <MessagingWorkspace />
    </Suspense>
  );
}

function MessagingWorkspace() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<MessagingTab>(() =>
    parseTab(searchParams.get("tab")),
  );

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-extrabold text-t1">문자·알림톡 발송</h1>
        <p className="mt-1 text-sm text-t3">
          수신처와 내용을 선택해 문자를 발송하고 발송 이력을 확인합니다.
        </p>
      </header>

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
    </div>
  );
}
