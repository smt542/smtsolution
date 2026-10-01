"use client";
import { useEffect, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { CustomDropdown, Panel, Switch } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";
import { useRegisterSetupSave } from "../SetupSaveContext";

const DAY_OPTIONS = [1, 3, 5, 7, 14, 30].map((d) => ({ value: String(d), label: `${d}일` }));

export function NotificationSettingsTab() {
  const { data: me } = useMe();
  const { data: config } = useSetupConfig(me?.orgId);
  const upsert = useUpsertSetupConfig();

  const [notifyMoveIn, setNotifyMoveIn] = useState(true);
  const [notifyLeaseExpiry, setNotifyLeaseExpiry] = useState(true);
  const [leaseExpiryDays, setLeaseExpiryDays] = useState(7);

  useEffect(() => {
    if (!config) return;
    setNotifyMoveIn.call(undefined, config.notifyMoveIn !== false);
    setNotifyLeaseExpiry.call(undefined, config.notifyLeaseExpiry !== false);
    setLeaseExpiryDays.call(undefined, config.leaseExpiryDays || 7);
  }, [config]);

  const save = async () => {
    if (!me?.orgId) { toast.error("인증 정보가 없습니다"); return; }
    try {
      await upsert.mutateAsync({ orgId: me.orgId, patch: { notifyMoveIn, notifyLeaseExpiry, leaseExpiryDays } });
      toast.success("저장되었습니다");
    } catch (e) { toast.error(e, "알림 설정을 저장하지 못했습니다."); }
  };

  useRegisterSetupSave(save, upsert.isPending);

  return (
    <Panel title="알림 설정" variant="titlebar">
      <div className="flex flex-col gap-[10px]">
        <div className="flex items-center justify-between gap-4 rounded-[12px] border border-line px-[16px] py-[14px]">
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-t1">입주 예정 세대 알림</div>
            <div className="h-[18px] pt-[3px] text-[12.5px] font-medium leading-[15px] text-t3">입주 예정일에 대상 세대를 담당자에게 알려줍니다.</div>
          </div>
          <Switch checked={notifyMoveIn} onChange={setNotifyMoveIn} ariaLabel="입주 예정 세대 알림" />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-[12px] border border-line px-[16px] py-[14px]">
          <div className="min-w-0">
            <div className="text-[14px] font-bold text-t1">임대 만료일 알림</div>
            <div className="h-[18px] pt-[3px] text-[12.5px] font-medium leading-[15px] text-t3">설정한 일수만큼 앞서부터 만료 예정 세대를 알려줍니다.</div>
          </div>
          <div className="flex flex-none items-center gap-[10px]">
            <div className="flex items-center gap-[6px]">
              <span className="text-[12.5px] font-bold text-t2">만료</span>
              <CustomDropdown
                chevron="rotate"
                ariaLabel="임대 만료 알림 시작 일수"
                size="notification"
                variant="field"
                position="fixed"
                value={String(leaseExpiryDays)}
                onChange={(value) => setLeaseExpiryDays(Number(value))}
                disabled={!notifyLeaseExpiry}
                options={DAY_OPTIONS}
                menuClassName="leading-[normal] [&.uc-dd-menu]:shadow-[0_14px_34px_-10px_rgba(23,31,40,0.28)] [&_.uc-opt]:px-[11px] [&_.uc-opt]:py-[9px] [&_.uc-opt.on]:bg-blue-t [&_.uc-opt.on]:text-blue"
              />
              <span className="text-[12.5px] font-bold text-t2">전부터</span>
            </div>
            <Switch checked={notifyLeaseExpiry} onChange={setNotifyLeaseExpiry} ariaLabel="임대 만료일 알림" />
          </div>
        </div>
      </div>
    </Panel>
  );
}
