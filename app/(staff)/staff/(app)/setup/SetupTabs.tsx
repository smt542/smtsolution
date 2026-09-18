"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button, Tabs } from "@/components/common";
import { PageHeader } from "@/components/shell/PageHeader";
import { SetupSaveProvider, useSetupSaveTarget } from "./SetupSaveContext";

const CompanyInfoTab = dynamic(() =>
  import("./components/CompanyInfoTab").then((module) => module.CompanyInfoTab));
const BillingSettingsTab = dynamic(() =>
  import("./components/BillingSettingsTab").then((module) => module.BillingSettingsTab));
const MovingSettlementSettingsTab = dynamic(() =>
  import("./components/MovingSettlementSettingsTab").then(
    (module) => module.MovingSettlementSettingsTab,
  ));
const AsSettingsTab = dynamic(() =>
  import("./components/AsSettingsTab").then((module) => module.AsSettingsTab));
const NotificationSettingsTab = dynamic(() =>
  import("./components/NotificationSettingsTab").then((module) => module.NotificationSettingsTab));
const DataMigrationTab = dynamic(() =>
  import("./components/DataMigrationTab").then((module) => module.DataMigrationTab));

// 정본(Figma) 6탭. 계좌 설정은 고지서·이사정산 탭으로 흡수됐고,
// 시스템 설정은 정본에 없어 삭제했다(2026-09-18 사용자 결정).
// 룸타입·자주 보내는 문자 마스터는 테이블·훅이 그대로 살아 있고 편집 UI만 사라진 상태다.
const TAB_DEFS = [
  { id: "company", label: "회사 정보" },
  { id: "billing", label: "고지서 설정" },
  { id: "settlement", label: "이사정산 설정" },
  { id: "as", label: "A/S 설정" },
  { id: "notifications", label: "알림 설정" },
  { id: "migration", label: "데이터 이관" },
] as const;

export type SetupTab = (typeof TAB_DEFS)[number]["id"];

/** 정본은 헤더에 저장 버튼이 하나뿐이고, 그 버튼이 지금 열린 탭의 폼을 저장한다. */
function SetupSaveButton() {
  const target = useSetupSaveTarget();
  return (
    <Button
      type="button"
      onClick={() => void target?.save()}
      disabled={!target || target.saving}
    >
      저장
    </Button>
  );
}

export function SetupTabs({ initialTab }: { initialTab: SetupTab }) {
  const [tab, setTab] = useState<SetupTab>(initialTab);

  return (
    <SetupSaveProvider>
      <div className="flex min-h-full flex-col bg-bg">
        <PageHeader title="셋업 설정" actions={<SetupSaveButton />} />
        <div className="shrink-0">
          <Tabs
            tabs={[...TAB_DEFS]}
            active={tab}
            onChange={(id) => setTab(id as SetupTab)}
            size="page"
          />
        </div>
        <div className="flex-1 px-[24px] pb-[30px] pt-[22px]">
          {tab === "company" && <CompanyInfoTab />}
          {tab === "billing" && <BillingSettingsTab />}
          {tab === "settlement" && <MovingSettlementSettingsTab />}
          {tab === "as" && <AsSettingsTab />}
          {tab === "notifications" && <NotificationSettingsTab />}
          {tab === "migration" && <DataMigrationTab />}
        </div>
      </div>
    </SetupSaveProvider>
  );
}
