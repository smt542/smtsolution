"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/common";
import {
  usePlatformSettings,
  useUpdatePlatformSettings,
  type PlatformSettings,
  type PlatformSettingsInput,
} from "@/hooks/reactquery/platform";
import { formatNumber as formatNumericValue } from "@/lib/format";
import { PageHeader, QueryError } from "../../_components/PageElements";
import { PlatformPageContainer } from "../../_components/PlatformPageContainer";

interface SettingsDraft {
  rateKrwAlimtalk: string;
  rateKrwSms: string;
  rateKrwLms: string;
  rateKrwFax: string;
  lowBalanceThreshold: string;
  billingBank: string;
  billingAccountNo: string;
  billingAccountHolder: string;
  businessRegNo: string;
  invoiceNotice: string;
  billingBasis: string;
  paymentDueDays: string;
  vatRate: string;
  contactPerson: string;
}

const emptyDraft: SettingsDraft = {
  rateKrwAlimtalk: "0",
  rateKrwSms: "0",
  rateKrwLms: "0",
  rateKrwFax: "0",
  lowBalanceThreshold: "0",
  billingBank: "",
  billingAccountNo: "",
  billingAccountHolder: "",
  businessRegNo: "",
  invoiceNotice: "",
  billingBasis: "",
  paymentDueDays: "0",
  vatRate: "10",
  contactPerson: "",
};

export default function PlatformSettingsPage() {
  const settingsQuery = usePlatformSettings();
  const updateSettings = useUpdatePlatformSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [draftOverride, setDraftOverride] = useState<SettingsDraft | null>(null);
  const draft = draftOverride
    ?? (settingsQuery.data ? toDraft(settingsQuery.data) : emptyDraft);

  const change = (field: keyof SettingsDraft, value: string) => {
    setDraftOverride((current) => ({ ...(current ?? draft), [field]: value }));
  };

  const beginEditing = () => {
    if (settingsQuery.data) setDraftOverride(toDraft(settingsQuery.data));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraftOverride(null);
    setIsEditing(false);
  };

  const save = async () => {
    try {
      await updateSettings.mutateAsync(toInput(draft));
      setDraftOverride(null);
      setIsEditing(false);
      toast.success("HQ 설정을 저장했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "설정을 저장하지 못했습니다.");
    }
  };

  return (
    <PlatformPageContainer maxWidthClassName="max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="SETTINGS"
          title="설정"
          description="본사 공통 발송 단가와 청구서 표기 정보를 관리합니다."
        />
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={updateSettings.isPending}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-[11px] bg-blue px-[15px] text-[13.5px] font-bold text-white shadow-pri transition-colors hover:bg-blue-d disabled:cursor-not-allowed disabled:opacity-70"
            >
              {updateSettings.isPending ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={updateSettings.isPending}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-[11px] border border-line bg-surface px-[15px] text-[13.5px] font-bold text-t2 transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:opacity-70"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={beginEditing}
            disabled={!settingsQuery.data}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-[11px] bg-blue px-[15px] text-[13.5px] font-bold text-white shadow-pri transition-colors hover:bg-blue-d disabled:cursor-not-allowed disabled:opacity-70"
          >
            수정
          </button>
        )}
      </div>

      {settingsQuery.isPending ? (
        <div className="flex min-h-[360px] items-center justify-center"><Spinner /></div>
      ) : settingsQuery.isError ? (
        <div className="mt-6"><QueryError onRetry={() => void settingsQuery.refetch()} /></div>
      ) : (
        <div className="mt-6 grid gap-5">
          <SettingsSection title="발송 단가 · 알림" helper="팝빌 계약 단가에 맞춰 입력하세요">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-px bg-line2">
              <NumberSetting
                label="알림톡"
                unit="원/건"
                value={draft.rateKrwAlimtalk}
                editing={isEditing}
                onChange={(value) => change("rateKrwAlimtalk", value)}
              />
              <NumberSetting
                label="문자(SMS)"
                unit="원/건"
                value={draft.rateKrwSms}
                editing={isEditing}
                onChange={(value) => change("rateKrwSms", value)}
              />
              <NumberSetting
                label="장문(LMS)"
                unit="원/건"
                value={draft.rateKrwLms}
                editing={isEditing}
                onChange={(value) => change("rateKrwLms", value)}
              />
              <NumberSetting
                label="팩스"
                unit="원/페이지"
                value={draft.rateKrwFax}
                editing={isEditing}
                onChange={(value) => change("rateKrwFax", value)}
              />
              <NumberSetting
                label="잔액 알림 기준"
                unit="P 이하"
                value={draft.lowBalanceThreshold}
                editing={isEditing}
                onChange={(value) => change("lowBalanceThreshold", value)}
              />
            </div>
          </SettingsSection>

          <SettingsSection title="청구 계좌" helper="업체 청구서에 표기되는 입금 계좌입니다">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-px bg-line2">
              <TextSetting label="은행" value={draft.billingBank} editing={isEditing} onChange={(value) => change("billingBank", value)} />
              <TextSetting label="계좌번호" value={draft.billingAccountNo} editing={isEditing} onChange={(value) => change("billingAccountNo", value)} />
              <TextSetting label="예금주" value={draft.billingAccountHolder} editing={isEditing} onChange={(value) => change("billingAccountHolder", value)} />
              <TextSetting label="사업자등록번호" value={draft.businessRegNo} editing={isEditing} onChange={(value) => change("businessRegNo", value)} />
              <label className="col-span-full block bg-surface p-[16px] px-[18px]">
                <span className="block text-[12.5px] font-bold text-t3">청구서 안내 문구</span>
                {isEditing ? (
                  <textarea
                    aria-label="청구서 안내 문구"
                    value={draft.invoiceNotice}
                    onChange={(event) => change("invoiceNotice", event.target.value)}
                    className="mt-[9px] min-h-28 w-full rounded-[9px] border border-line bg-surface px-3 py-2.5 text-[13.5px] font-bold leading-6 text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t"
                  />
                ) : (
                  <div className="mt-[9px]">
                    <SettingValue value={draft.invoiceNotice} multiline />
                  </div>
                )}
              </label>
            </div>
          </SettingsSection>

          <SettingsSection title="청구 기준">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-px bg-line2">
              <TextSetting
                label="청구 기준"
                value={draft.billingBasis}
                editing={isEditing}
                onChange={(value) => change("billingBasis", value)}
              />
              <NumberSetting
                label="입금 기한"
                unit="일"
                value={draft.paymentDueDays}
                editing={isEditing}
                onChange={(value) => change("paymentDueDays", value)}
              />
              <NumberSetting
                label="부가세"
                unit="%"
                value={draft.vatRate}
                editing={isEditing}
                onChange={(value) => change("vatRate", value)}
                step="0.1"
              />
              <TextSetting label="담당자" value={draft.contactPerson} editing={isEditing} onChange={(value) => change("contactPerson", value)} />
            </div>
          </SettingsSection>
        </div>
      )}
    </PlatformPageContainer>
  );
}

function SettingsSection({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-surface shadow-card">
      <div className="flex items-center gap-2.5 border-b border-line2 px-[18px] py-[15px]">
        <h2 className="text-[15px] font-extrabold text-t1">{title}</h2>
        <div className="flex-1" />
        {helper && <p className="text-right text-xs font-semibold text-t3">{helper}</p>}
      </div>
      {children}
    </section>
  );
}

function TextSetting({
  label,
  value,
  editing,
  onChange,
  hideLabel = false,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  hideLabel?: boolean;
}) {
  return (
    <label className="block bg-surface p-[16px] px-[18px]">
      {!hideLabel && <span className="block text-[12.5px] font-bold text-t3">{label}</span>}
      {editing ? (
        <input
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="mt-[9px] h-[38px] w-full rounded-[9px] border border-line bg-surface px-3 text-[13.5px] font-bold text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t"
        />
      ) : (
        <div className="mt-[9px]">
          <SettingValue value={value} />
        </div>
      )}
    </label>
  );
}

function NumberSetting({
  label,
  unit,
  value,
  editing,
  onChange,
  hideLabel = false,
  step = "1",
}: {
  label: string;
  unit: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  hideLabel?: boolean;
  step?: string;
}) {
  return (
    <label className="block bg-surface p-[16px] px-[18px]">
      {!hideLabel && <span className="block text-[12.5px] font-bold text-t3">{label}</span>}
      {editing ? (
        <span className="mt-[9px] flex items-center gap-[7px]">
          <input
            aria-label={label}
            type="number"
            min="0"
            step={step}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-full max-w-[110px] min-w-0 rounded-[9px] border border-line bg-surface px-[11px] text-right text-[13.5px] font-bold tabular-nums text-t1 outline-none focus:border-blue focus:ring-[3px] focus:ring-blue-t"
          />
          <span className="whitespace-nowrap text-[12.5px] font-semibold text-t3">{unit}</span>
        </span>
      ) : (
        <div className="mt-[9px] flex items-baseline gap-1.5">
          <span className="text-lg font-extrabold tabular-nums text-t1">{formatNumber(value)}</span>
          <span className="text-[12.5px] font-semibold text-t3">{unit}</span>
        </div>
      )}
    </label>
  );
}

function SettingValue({ value, multiline = false }: { value: string; multiline?: boolean }) {
  return (
    <p className={`text-[13.5px] leading-6 text-t1 ${multiline ? "whitespace-pre-wrap" : ""}`}>
      {value || "—"}
    </p>
  );
}

function toDraft(settings: PlatformSettings): SettingsDraft {
  return {
    rateKrwAlimtalk: String(settings.rateKrwAlimtalk),
    rateKrwSms: String(settings.rateKrwSms),
    rateKrwLms: String(settings.rateKrwLms),
    rateKrwFax: String(settings.rateKrwFax),
    lowBalanceThreshold: String(settings.lowBalanceThreshold),
    billingBank: settings.billingBank ?? "",
    billingAccountNo: settings.billingAccountNo ?? "",
    billingAccountHolder: settings.billingAccountHolder ?? "",
    businessRegNo: settings.businessRegNo ?? "",
    invoiceNotice: settings.invoiceNotice ?? "",
    billingBasis: settings.billingBasis ?? "",
    paymentDueDays: String(settings.paymentDueDays),
    vatRate: String(settings.vatRate),
    contactPerson: settings.contactPerson ?? "",
  };
}

function toInput(draft: SettingsDraft): PlatformSettingsInput {
  return {
    rateKrwAlimtalk: requiredNumber(draft.rateKrwAlimtalk, "알림톡", true),
    rateKrwSms: requiredNumber(draft.rateKrwSms, "문자", true),
    rateKrwLms: requiredNumber(draft.rateKrwLms, "장문(LMS)", true),
    rateKrwFax: requiredNumber(draft.rateKrwFax, "팩스", true),
    lowBalanceThreshold: requiredNumber(draft.lowBalanceThreshold, "잔액 알림 기준", true),
    billingBank: nullableText(draft.billingBank),
    billingAccountNo: nullableText(draft.billingAccountNo),
    billingAccountHolder: nullableText(draft.billingAccountHolder),
    businessRegNo: nullableText(draft.businessRegNo),
    invoiceNotice: nullableText(draft.invoiceNotice),
    billingBasis: nullableText(draft.billingBasis),
    paymentDueDays: requiredNumber(draft.paymentDueDays, "입금 기한", true),
    vatRate: requiredNumber(draft.vatRate, "부가세"),
    contactPerson: nullableText(draft.contactPerson),
  };
}

function requiredNumber(value: string, label: string, integer = false): number {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${label} 값을 0 이상의 ${integer ? "정수" : "숫자"}로 입력해 주세요.`);
  }
  return parsed;
}

function nullableText(value: string): string | null {
  return value.trim() || null;
}

function formatNumber(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatNumericValue(parsed) : value;
}
