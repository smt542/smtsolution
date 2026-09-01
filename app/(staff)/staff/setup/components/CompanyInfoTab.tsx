"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Input, Panel } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";

type F = {
  companyName: string; companyPhone: string; companyFax: string; bizRegNo: string;
  ceoName: string; companyAddress: string; operatingHours: string;
};
const EMPTY: F = {
  companyName: "", companyPhone: "", companyFax: "", bizRegNo: "",
  ceoName: "", companyAddress: "", operatingHours: "",
};

const FIELDS: { key: keyof F; label: string; hint?: string; placeholder: string; width: string }[] = [
  { key: "companyName", label: "상호", hint: "세입자 앱과 고지서에 표기되는 회사명", placeholder: "상호", width: "sm:max-w-[240px]" },
  { key: "companyPhone", label: "대표 전화", hint: "세입자 문의 안내에 노출돼요. 건물별 담당 연락처가 없을 때 이 번호가 표기됩니다", placeholder: "042-000-0000", width: "sm:max-w-[200px]" },
  { key: "companyFax", label: "팩스", placeholder: "042-000-0000", width: "sm:max-w-[200px]" },
  { key: "bizRegNo", label: "사업자등록번호", placeholder: "000-00-00000", width: "sm:max-w-[200px]" },
  { key: "ceoName", label: "대표자", placeholder: "대표자명", width: "sm:max-w-[160px]" },
  { key: "companyAddress", label: "주소", placeholder: "주소", width: "sm:max-w-[400px]" },
  { key: "operatingHours", label: "운영 시간", hint: "세입자 안내 문구에 함께 표기돼요", placeholder: "평일 09:00 ~ 18:00", width: "sm:max-w-[240px]" },
];

export function CompanyInfoTab() {
  const { data: me } = useMe();
  const { data: config } = useSetupConfig(me?.orgId);
  const upsert = useUpsertSetupConfig();
  const [f, setF] = useState<F>(EMPTY);

  useEffect(() => {
    if (!config) return;
    setF.call(undefined, {
      companyName: config.companyName ?? "", companyPhone: config.companyPhone ?? "",
      companyFax: config.companyFax ?? "", bizRegNo: config.bizRegNo ?? "",
      ceoName: config.ceoName ?? "", companyAddress: config.companyAddress ?? "",
      operatingHours: config.operatingHours ?? "",
    });
  }, [config]);
  const upd = (k: keyof F, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!me?.orgId) { toast.error("인증 정보가 없습니다"); return; }
    try { await upsert.mutateAsync({ orgId: me.orgId, patch: { ...f } }); toast.success("저장되었습니다"); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <Panel title="관리업체 정보" action={<Button variant="primary" onClick={save} disabled={upsert.isPending}>저장</Button>}>
      <p className="mb-4 text-sm text-t3">세입자 앱과 고지서·알림톡에 표기되는 대표 정보예요</p>
      <div className="flex flex-col divide-y divide-line2">
        {FIELDS.map((fld) => (
          <div key={fld.key} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <div className="text-sm font-bold text-t1">{fld.label}</div>
              {fld.hint && <div className="mt-1 text-xs text-t3">{fld.hint}</div>}
            </div>
            <Input
              aria-label={fld.label}
              className={`w-full ${fld.width}`}
              value={f[fld.key]}
              placeholder={fld.placeholder}
              onChange={(e) => upd(fld.key, e.target.value)}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}
