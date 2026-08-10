"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Checkbox, Panel } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";

type F = {
  mgmtBank1: string; mgmtAcct1: string; mgmtHolder1: string; mgmtPrint1: boolean;
  mgmtBank2: string; mgmtAcct2: string; mgmtHolder2: string; mgmtPrint2: boolean;
  settleBank: string; settleAcct: string; settleHolder: string;
};
const EMPTY: F = { mgmtBank1:"", mgmtAcct1:"", mgmtHolder1:"", mgmtPrint1:true,
  mgmtBank2:"", mgmtAcct2:"", mgmtHolder2:"", mgmtPrint2:true, settleBank:"", settleAcct:"", settleHolder:"" };

export function AccountSettingsTab() {
  const { data: me } = useMe();
  const { data: config } = useSetupConfig();
  const upsert = useUpsertSetupConfig();
  const [f, setF] = useState<F>(EMPTY);

  useEffect(() => {
    if (!config) return;
    setF({
      mgmtBank1: config.mgmtBank1 ?? "", mgmtAcct1: config.mgmtAcct1 ?? "", mgmtHolder1: config.mgmtHolder1 ?? "", mgmtPrint1: config.mgmtPrint1,
      mgmtBank2: config.mgmtBank2 ?? "", mgmtAcct2: config.mgmtAcct2 ?? "", mgmtHolder2: config.mgmtHolder2 ?? "", mgmtPrint2: config.mgmtPrint2,
      settleBank: config.settleBank ?? "", settleAcct: config.settleAcct ?? "", settleHolder: config.settleHolder ?? "",
    });
  }, [config]);
  const upd = (k: keyof F, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!me?.orgId) { toast.error("인증 정보가 없습니다"); return; }
    try { await upsert.mutateAsync({ orgId: me.orgId, patch: { ...f } }); toast.success("저장되었습니다"); }
    catch (e: any) { toast.error(e.message ?? "저장 실패"); }
  };

  return (
    <Panel title="계좌 설정" action={<Button variant="primary" onClick={save} disabled={upsert.isPending}>저장</Button>}>
      <div className="flex flex-col gap-6">
        {([1, 2] as const).map((n) => (
          <div key={n} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-t1">관리비 입금계좌 {n}</span>
              <Checkbox label="고지서 출력" checked={f[`mgmtPrint${n}` as keyof F] as boolean}
                onChange={(e) => upd(`mgmtPrint${n}` as keyof F, e.target.checked)} />
            </div>
            <Input aria-label={`관리비 은행 ${n}`} placeholder="은행명" value={f[`mgmtBank${n}` as keyof F] as string} onChange={(e) => upd(`mgmtBank${n}` as keyof F, e.target.value)} />
            <Input aria-label={`관리비 계좌번호 ${n}`} placeholder="계좌번호" value={f[`mgmtAcct${n}` as keyof F] as string} onChange={(e) => upd(`mgmtAcct${n}` as keyof F, e.target.value)} />
            <Input aria-label={`관리비 예금주 ${n}`} placeholder="예금주" value={f[`mgmtHolder${n}` as keyof F] as string} onChange={(e) => upd(`mgmtHolder${n}` as keyof F, e.target.value)} />
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-bold text-t1">이사정산 입금계좌</span>
          <Input aria-label="정산 은행" placeholder="은행명" value={f.settleBank} onChange={(e) => upd("settleBank", e.target.value)} />
          <Input aria-label="정산 계좌번호" placeholder="계좌번호" value={f.settleAcct} onChange={(e) => upd("settleAcct", e.target.value)} />
          <Input aria-label="정산 예금주" placeholder="예금주" value={f.settleHolder} onChange={(e) => upd("settleHolder", e.target.value)} />
        </div>
      </div>
    </Panel>
  );
}
