"use client";
import { useEffect, useState } from "react";
import { appToast as toast } from "@/hooks/common/useAppToast";
import { Input, Panel } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import { useSetupConfig, useUpsertSetupConfig } from "@/hooks/reactquery/setupConfig";
import { useRegisterSetupSave } from "../SetupSaveContext";

type F = {
  companyName: string; companyPhone: string; companyFax: string; bizRegNo: string;
  ceoName: string; companyAddress: string; operatingHours: string;
};

const EMPTY: F = {
  companyName: "", companyPhone: "", companyFax: "", bizRegNo: "",
  ceoName: "", companyAddress: "", operatingHours: "",
};

const FIELDS: { key: keyof F; label: string; hint?: string; placeholder: string; width: string }[] = [
  { key: "companyName", label: "상호", hint: "세입자 앱과 고지서에 표기되는 회사명", placeholder: "상호", width: "w-[240px]" },
  { key: "companyPhone", label: "대표 전화", hint: "세입자 문의 안내에 노출돼요. 건물별 담당 연락처가 없을 때 이 번호가 표기됩니다", placeholder: "042-000-0000", width: "w-[180px]" },
  { key: "companyFax", label: "팩스", placeholder: "042-000-0000", width: "w-[180px]" },
  { key: "bizRegNo", label: "사업자등록번호", placeholder: "000-00-00000", width: "w-[180px]" },
  { key: "ceoName", label: "대표자", placeholder: "대표자명", width: "w-[140px]" },
  { key: "companyAddress", label: "주소", placeholder: "주소", width: "w-[360px]" },
  { key: "operatingHours", label: "운영 시간", hint: "세입자 안내 문구에 함께 표기돼요", placeholder: "평일 09:00 ~ 18:00", width: "w-[240px]" },
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

  const upd = (key: keyof F, value: string) => setF((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!me?.orgId) { toast.error("인증 정보가 없습니다"); return; }
    try {
      await upsert.mutateAsync({ orgId: me.orgId, patch: { ...f } });
      toast.success("저장되었습니다");
    } catch (e) {
      toast.error(e, "관리업체 정보를 저장하지 못했습니다.");
    }
  };

  useRegisterSetupSave(save, upsert.isPending);

  return (
    <Panel
      title="관리업체 정보"
      subtitle="세입자 앱과 고지서·알림톡에 표기되는 대표 정보예요"
      variant="compact"
    >
      <div className="flex flex-col">
        {FIELDS.map((field, index) => (
          <div
            key={field.key}
            className={`flex items-center gap-[16px] ${
              index === 0
                ? "border-b border-line2 pb-[12px]"
                : index === FIELDS.length - 1
                  ? "pt-[12px]"
                  : "border-b border-line2 py-[12px]"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="h-[16px] text-[14px] font-bold leading-[16px] text-t1">{field.label}</div>
              {field.hint && (
                <div className="h-[18px] pt-[3px] text-[12.5px] font-medium leading-[15px] text-t3">
                  {field.hint}
                </div>
              )}
            </div>
            <Input
              size="38"
              aria-label={field.label}
              className={`shrink-0 ${field.width}`}
              value={f[field.key]}
              placeholder={field.placeholder}
              onChange={(event) => upd(field.key, event.target.value)}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}
