"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Tabs } from "@/components/common";

const CompanyInfoTab = dynamic(() =>
  import("./components/CompanyInfoTab").then((module) => module.CompanyInfoTab));
const BillingSettingsTab = dynamic(() =>
  import("./components/BillingSettingsTab").then((module) => module.BillingSettingsTab));
const AccountSettingsTab = dynamic(() =>
  import("./components/AccountSettingsTab").then((module) => module.AccountSettingsTab));
const MovingSettlementSettingsTab = dynamic(() =>
  import("./components/MovingSettlementSettingsTab").then(
    (module) => module.MovingSettlementSettingsTab,
  ));
const AsSettingsTab = dynamic(() =>
  import("./components/AsSettingsTab").then((module) => module.AsSettingsTab));
const NotificationSettingsTab = dynamic(() =>
  import("./components/NotificationSettingsTab").then((module) => module.NotificationSettingsTab));
const SystemSettingsTab = dynamic(() =>
  import("./components/SystemSettingsTab").then((module) => module.SystemSettingsTab));
const DataMigrationTab = dynamic(() =>
  import("./components/DataMigrationTab").then((module) => module.DataMigrationTab));

// 순서는 Claude Design 프로토타입(회사 정보 → 고지서 → 이사정산 → A/S → 알림 → 데이터 이관)에 맞춘다.
// 계좌·시스템 탭은 프로토타입엔 없지만 기존 기능 보존을 위해 유지(계좌=고지서 옆, 시스템=알림 뒤).
const TAB_DEFS = [
  { id: "company", label: "회사 정보" },
  { id: "billing", label: "고지서 설정" },
  { id: "accounts", label: "계좌 설정" },
  { id: "settlement", label: "이사정산 설정" },
  { id: "as", label: "A/S 설정" },
  { id: "notifications", label: "알림 설정" },
  { id: "system", label: "시스템 설정" },
  { id: "migration", label: "데이터 이관" },
] as const;

export type SetupTab = (typeof TAB_DEFS)[number]["id"];

export function SetupTabs({ initialTab }: { initialTab: SetupTab }) {
  const [tab, setTab] = useState<SetupTab>(initialTab);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-extrabold text-t1">셋업 설정</h1>
      <Tabs tabs={[...TAB_DEFS]} active={tab} onChange={(id) => setTab(id as SetupTab)} />
      <div>
        {tab === "company" && <CompanyInfoTab />}
        {tab === "billing" && <BillingSettingsTab />}
        {tab === "accounts" && <AccountSettingsTab />}
        {tab === "settlement" && <MovingSettlementSettingsTab />}
        {tab === "as" && <AsSettingsTab />}
        {tab === "notifications" && <NotificationSettingsTab />}
        {tab === "system" && <SystemSettingsTab />}
        {tab === "migration" && <DataMigrationTab />}
      </div>
    </div>
  );
}
