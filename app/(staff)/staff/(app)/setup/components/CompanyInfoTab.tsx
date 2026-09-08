"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge, Button, Input, Panel } from "@/components/common";
import { useMe } from "@/hooks/reactquery/auth";
import {
  useSaveSetupSender,
  useSetupConfig,
  useUpsertSetupConfig,
  type SetupSenderProduct,
} from "@/hooks/reactquery/setupConfig";

type F = {
  companyName: string; companyPhone: string; companyFax: string; bizRegNo: string;
  ceoName: string; companyAddress: string; operatingHours: string;
};
const EMPTY: F = {
  companyName: "", companyPhone: "", companyFax: "", bizRegNo: "",
  ceoName: "", companyAddress: "", operatingHours: "",
};
type SenderForm = Record<SetupSenderProduct, string>;
const EMPTY_SENDERS: SenderForm = { sms: "", fax: "" };

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
  const saveSender = useSaveSetupSender();
  const [f, setF] = useState<F>(EMPTY);
  const [senders, setSenders] = useState<SenderForm>(EMPTY_SENDERS);

  useEffect(() => {
    if (!config) return;
    setF.call(undefined, {
      companyName: config.companyName ?? "", companyPhone: config.companyPhone ?? "",
      companyFax: config.companyFax ?? "", bizRegNo: config.bizRegNo ?? "",
      ceoName: config.ceoName ?? "", companyAddress: config.companyAddress ?? "",
      operatingHours: config.operatingHours ?? "",
    });
    setSenders.call(undefined, { sms: config.smsSender ?? "", fax: config.faxSender ?? "" });
  }, [config]);
  const upd = (k: keyof F, v: string) => setF((p) => ({ ...p, [k]: v }));
  const updateSender = (product: SetupSenderProduct, value: string) =>
    setSenders((current) => ({ ...current, [product]: value.replace(/\D/g, "") }));

  const save = async () => {
    if (!me?.orgId) { toast.error("인증 정보가 없습니다"); return; }
    try { await upsert.mutateAsync({ orgId: me.orgId, patch: { ...f } }); toast.success("저장되었습니다"); }
    catch (e) { toast.error(e instanceof Error ? e.message : String(e)); }
  };

  const verifyAndSaveSender = async (product: SetupSenderProduct) => {
    try {
      const result = await saveSender.mutateAsync({ product, number: senders[product] });
      setSenders((current) => ({ ...current, [product]: result.number ?? "" }));
      toast.success(result.number ? "발신번호를 검증하고 저장했습니다" : "운영사 기본 발신번호를 사용합니다");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const senderRows: Array<{
    product: SetupSenderProduct;
    label: string;
    verifiedAt: string | null | undefined;
  }> = [
    { product: "sms", label: "SMS 발신번호", verifiedAt: config?.smsSenderVerifiedAt },
    { product: "fax", label: "팩스 발신번호", verifiedAt: config?.faxSenderVerifiedAt },
  ];

  return (
    <Panel title="관리업체 정보" action={<Button variant="primary" onClick={save} disabled={upsert.isPending}>저장</Button>}>
      <p className="mb-4 text-sm text-t3">세입자 앱과 고지서·알림톡에 표기되는 대표 정보예요</p>
      <p className="mb-4 text-xs text-t3">
        SMS·팩스 발신번호는 운영사 팝빌 계정에 사전 등록된 번호만 사용할 수 있습니다. 미설정 시
        운영사 기본번호로 발송됩니다.
      </p>
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
        {senderRows.map(({ product, label, verifiedAt }) => (
          <div
            key={product}
            className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-bold text-t1">{label}</div>
                {verifiedAt ? (
                  <Badge className="bg-green-t px-2 py-1 text-green">
                    팝빌 등록 확인 ({new Intl.DateTimeFormat("ko-KR").format(new Date(verifiedAt))})
                  </Badge>
                ) : (
                  <Badge className="bg-bg px-2 py-1 text-t3">미설정 · 운영사 기본번호 사용</Badge>
                )}
              </div>
              <div className="mt-1 text-xs text-t3">빈 값으로 저장하면 운영사 기본번호를 사용합니다.</div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:max-w-[340px] sm:flex-row">
              <Input
                aria-label={label}
                inputMode="numeric"
                value={senders[product]}
                placeholder="숫자만 입력"
                onChange={(e) => updateSender(product, e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                className="shrink-0"
                disabled={saveSender.isPending}
                onClick={() => void verifyAndSaveSender(product)}
              >
                {saveSender.isPending && saveSender.variables?.product === product
                  ? "확인 중…"
                  : "검증·저장"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
