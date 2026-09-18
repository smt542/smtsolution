import { redirect } from "next/navigation";
import { canManageSettings } from "@/lib/auth/permissions";
import { getStaffContext } from "../_staffContext";
import { SetupTabs, type SetupTab } from "./SetupTabs";

type SetupSearchParams = {
  tab?: string | string[];
};

const SETUP_TAB_IDS: readonly SetupTab[] = [
  "company",
  "billing",
  "settlement",
  "as",
  "notifications",
  "migration",
];

function parseTab(value: string | string[] | undefined): SetupTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab && SETUP_TAB_IDS.includes(tab as SetupTab)
    ? (tab as SetupTab)
    : "company";
}

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<SetupSearchParams>;
}) {
  const [me, query] = await Promise.all([getStaffContext(), searchParams]);
  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;

  if (requestedTab === "repair") redirect("/staff/long-term-repair");

  if (!canManageSettings(me)) {
    return (
      <div className="p-6">
        <p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (설정 변경 권한 필요)</p>
      </div>
    );
  }

  return <SetupTabs initialTab={parseTab(query.tab)} />;
}
