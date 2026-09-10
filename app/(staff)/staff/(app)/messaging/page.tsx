import { EmptyState } from "@/components/common";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { DrainScheduledButton } from "./components/DrainScheduledButton";
import {
  MessagingTabs,
  type MessagingTab,
} from "./components/MessagingTabs";

type MessagingSearchParams = {
  tab?: string | string[];
};

function parseTab(value: string | string[] | undefined): MessagingTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "templates" || tab === "history" ? tab : "send";
}

export default async function MessagingPage({
  searchParams,
}: {
  searchParams: Promise<MessagingSearchParams>;
}) {
  const [me, query] = await Promise.all([getStaffContext(), searchParams]);

  if (!me || !hasModule(me, "messaging")) {
    return (
      <div className="p-6">
        <EmptyState message="문자 발송 권한이 없습니다." />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-t1">문자·알림톡 발송</h1>
          <p className="mt-1 text-sm text-t3">
            수신처와 내용을 선택해 문자를 발송하고 발송 이력을 확인합니다.
          </p>
        </div>
        <DrainScheduledButton />
      </header>

      <MessagingTabs initialTab={parseTab(query.tab)} />
    </div>
  );
}
