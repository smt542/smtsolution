import { EmptyState } from "@/components/common";
import { hasModule } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import {
  MessagingTabs,
  type MessagingTab,
} from "./components/MessagingTabs";

type MessagingSearchParams = {
  tab?: string | string[];
};

function parseTab(value: string | string[] | undefined): MessagingTab {
  const tab = Array.isArray(value) ? value[0] : value;
  if (tab === "history" || tab === "templates" || tab === "bill") return tab;
  return "scheduled";
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

  return <MessagingTabs initialTab={parseTab(query.tab)} />;
}
