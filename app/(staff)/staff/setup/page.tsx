// app/(staff)/staff/setup/page.tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useMe } from "@/hooks/reactquery/auth";
import { canManageSettings } from "@/lib/auth/permissions";
import { Tabs } from "@/components/common";

const BillingSettingsTab = dynamic(() =>
  import("./components/BillingSettingsTab").then((module) => module.BillingSettingsTab));
const AccountSettingsTab = dynamic(() =>
  import("./components/AccountSettingsTab").then((module) => module.AccountSettingsTab));
const MovingSettlementSettingsTab = dynamic(() =>
  import("./components/MovingSettlementSettingsTab").then(
    (module) => module.MovingSettlementSettingsTab,
  ));
const SystemSettingsTab = dynamic(() =>
  import("./components/SystemSettingsTab").then((module) => module.SystemSettingsTab));

const TAB_DEFS = [
  { id: "billing", label: "고지서 설정" },
  { id: "accounts", label: "계좌 설정" },
  { id: "settlement", label: "이사정산 설정" },
  { id: "system", label: "시스템 설정" },
] as const;
type TabKey = (typeof TAB_DEFS)[number]["id"];
const TAB_IDS: readonly string[] = TAB_DEFS.map((t) => t.id);

function SetupContent() {
  const { data: me } = useMe();
  const sp = useSearchParams();
  const router = useRouter();
  const initial = sp.get("tab");
  const [tab, setTab] = useState<TabKey>(
    initial && TAB_IDS.includes(initial) ? (initial as TabKey) : "billing",
  );

  useEffect(() => {
    if (initial === "repair") router.replace("/staff/long-term-repair");
  }, [initial, router]);

  if (initial === "repair") return null;

  if (me === undefined) return null; // 로딩
  if (!canManageSettings(me)) {
    return (
      <div className="p-6">
        <p className="text-sm text-t3">이 화면에 접근할 권한이 없습니다. (설정 변경 권한 필요)</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-extrabold text-t1">셋업 설정</h1>
      <Tabs tabs={[...TAB_DEFS]} active={tab} onChange={(id) => setTab(id as TabKey)} />
      <div>
        {tab === "billing" && <BillingSettingsTab />}
        {tab === "accounts" && <AccountSettingsTab />}
        {tab === "settlement" && <MovingSettlementSettingsTab />}
        {tab === "system" && <SystemSettingsTab />}
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupContent />
    </Suspense>
  );
}
