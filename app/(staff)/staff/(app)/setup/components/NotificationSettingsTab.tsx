"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Select, Panel } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-[26px] w-11 flex-none rounded-full transition-colors ${on ? "bg-brand" : "bg-line"}`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[21px]" : "left-[3px]"}`}
      />
    </button>
  );
}

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
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Panel title="알림 설정" action={<Button variant="primary" onClick={save} disabled={upsert.isPending}>저장</Button>}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line p-4">
          <div className="min-w-0">
            <div className="text-sm font-bold text-t1">입주 예정 세대 알림</div>
            <div className="mt-1 text-xs text-t3">입주 예정일에 대상 세대를 담당자에게 알려줍니다.</div>
          </div>
          <Toggle on={notifyMoveIn} onChange={setNotifyMoveIn} label="입주 예정 세대 알림" />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-line p-4">
          <div className="min-w-0">
            <div className="text-sm font-bold text-t1">임대 만료일 알림</div>
            <div className="mt-1 text-xs text-t3">설정한 일수만큼 앞서부터 만료 예정 세대를 알려줍니다.</div>
          </div>
          <div className="flex flex-none items-center gap-2">
            <span className="text-xs font-bold text-t2">만료</span>
            <Select
              aria-label="임대 만료 알림 시작 일수"
              className="h-9 w-20 rounded-lg px-2"
              value={String(leaseExpiryDays)}
              onChange={(e) => setLeaseExpiryDays(Number(e.target.value))}
              disabled={!notifyLeaseExpiry}
              options={DAY_OPTIONS}
            />
            <span className="text-xs font-bold text-t2">전부터</span>
            <Toggle on={notifyLeaseExpiry} onChange={setNotifyLeaseExpiry} label="임대 만료일 알림" />
          </div>
        </div>
      </div>
    </Panel>
  );
}
