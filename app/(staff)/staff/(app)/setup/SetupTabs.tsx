"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button, Tabs } from "@/components/common";
import { PageHeader } from "@/components/shell/PageHeader";
import { appToast as toast } from "@/hooks/common/useAppToast";
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

/**
 * 정본은 헤더에 저장 버튼이 하나뿐이고, 그 버튼이 지금 열린 탭의 폼을 저장한다.
 * 버튼은 늘 켜 둔다(QA S26). 폼이 없는 탭(A/S 설정·데이터 이관 — 목록은 즉시 저장)에서는
 * 정본처럼 '저장되었습니다'만 띄우고, 저장 중에 다시 누른 것은 무시한다.
 */
function SetupSaveButton() {
  const target = useSetupSaveTarget();
  const onSave = () => {
    if (!target) {
      toast.success("저장되었습니다");
      return;
    }
    if (!target.saving) void target.save();
  };
  return (
    <Button type="button" onClick={onSave}>
      저장
    </Button>
  );
}

export function SetupTabs({ initialTab }: { initialTab: SetupTab }) {
  const [tab, setTab] = useState<SetupTab>(initialTab);

  return (
    <SetupSaveProvider>
      {/* 정본은 헤더·탭바가 고정이고 본문만 스크롤한다. AppShell이 이 경로를 뷰포트 고정으로 잡는다. */}
      <div className="flex h-full min-h-0 flex-col bg-bg">
        <PageHeader title="셋업 설정" actions={<SetupSaveButton />} />
        {/* 정본 탭바(노드 72:69569)는 흰 배경 + 아래 1px 선 + 좌우 24px 여백이고,
            탭 버튼 자체는 공용 Tabs의 underline 규격과 픽셀 단위로 같다.
            버튼은 공용 것을 쓰고 컨테이너 크롬만 여기서 두른다. */}
        <div className="shrink-0 border-b border-line bg-white px-[24px]">
          <Tabs
            tabs={[...TAB_DEFS]}
            active={tab}
            onChange={(id) => setTab(id as SetupTab)}
            variant="underline"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-[24px] pb-[30px] pt-[22px]">
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
