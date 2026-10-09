"use client";

import type { PlatformOrgBilling, PlatformSettings } from "@/hooks/reactquery/platform";
import { formatNumber } from "@/lib/format";

const num = (n: number) => formatNumber(n);

/** 설정(통합관리자 > 설정 > 청구 계좌·청구 기준)에 값이 없을 때 청구서에 찍는 문구 */
export const INVOICE_UNSET = "미등록";

/** 청구서에 그대로 찍는 발행처·입금 정보(미리보기·PDF 공통). 설정이 비었으면 '미등록' */
export interface InvoiceConfig {
  /** 발행처 이름 겸 예금주 */
  accountHolder: string;
  businessRegNo: string;
  contactPerson: string;
  /** 은행 + 계좌번호 */
  account: string;
  /** 입금 기한 — '발행일로부터 N일'(0일 = 미등록) */
  due: string;
  /** 청구서 안내 문구 — 비었으면 줄을 그리지 않는다 */
  notice: string;
  vatRate: number;
}

export function invoiceConfigFromSettings(
  settings: PlatformSettings | undefined,
): InvoiceConfig {
  const text = (value: string | null | undefined) => value?.trim() ?? "";
  const dueDays = settings?.paymentDueDays ?? 0;
  return {
    accountHolder: text(settings?.billingAccountHolder) || INVOICE_UNSET,
    businessRegNo: text(settings?.businessRegNo) || INVOICE_UNSET,
    contactPerson: text(settings?.contactPerson) || INVOICE_UNSET,
    account: [text(settings?.billingBank), text(settings?.billingAccountNo)].filter(Boolean).join(" ") || INVOICE_UNSET,
    due: dueDays > 0 ? `발행일로부터 ${dueDays}일` : INVOICE_UNSET,
    notice: text(settings?.invoiceNotice),
    vatRate: settings?.vatRate ?? 10,
  };
}

export function invoiceNo(month: string, orgId: number): string {
  // month is YYYY-MM-01 → INV-YYYYMM-{orgId}
  const [year, mon] = month.split("-");
  return `INV-${year}${mon}-${String(orgId).padStart(3, "0")}`;
}

export function todayLabel(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
}

export function periodLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return `${year}년 ${mon}월 발송분`;
}

export interface LineItem {
  name: string;
  count: number;
  unitPriceKrw: number;
  amountKrw: number;
}

/** 청구서 부가세율 — 저장된 청구서 스냅샷 우선, 없으면 설정값 */
export function invoiceVatRate(row: PlatformOrgBilling, config: InvoiceConfig): number {
  return row.vatRate ?? config.vatRate;
}

export function lineItems(row: PlatformOrgBilling, settings: PlatformSettings | undefined): LineItem[] {
  // 단가: 입금 확인으로 저장된 청구서의 스냅샷(없으면 현재 설정) — RPC가 고른 값(row.rateKrw*) 우선(개선3차 41)
  const rateAlimtalk = row.rateKrwAlimtalk ?? settings?.rateKrwAlimtalk ?? 0;
  const rateSms = row.rateKrwSms ?? settings?.rateKrwSms ?? 0;
  const rateLms = row.rateKrwLms ?? settings?.rateKrwLms ?? 0;
  const rateFax = row.rateKrwFax ?? settings?.rateKrwFax ?? 0;
  const items: LineItem[] = [];
  if (row.alimtalkCount > 0) {
    items.push({
      name: "알림톡",
      count: row.alimtalkCount,
      unitPriceKrw: rateAlimtalk,
      amountKrw: row.alimtalkAmountKrw,
    });
  }
  // SMS·LMS는 단가가 달라 행을 나눈다(건수 × 단가 = 금액). 서버는 둘을 smsAmountKrw 하나로 합쳐 주므로
  // SMS 행 = SMS 건수 × SMS 단가, LMS 행 = 합계 − SMS 행(두 행의 합이 저장 금액과 항상 같다).
  const smsAmountKrw = row.lmsCount > 0 ? row.smsCount * rateSms : row.smsAmountKrw;
  if (row.smsCount > 0) {
    items.push({
      name: "문자(SMS)",
      count: row.smsCount,
      unitPriceKrw: rateSms,
      amountKrw: smsAmountKrw,
    });
  }
  if (row.lmsCount > 0) {
    items.push({
      name: "장문(LMS)",
      count: row.lmsCount,
      unitPriceKrw: rateLms,
      amountKrw: row.smsAmountKrw - (row.smsCount > 0 ? smsAmountKrw : 0),
    });
  }
  if (row.faxCount > 0) {
    items.push({
      name: "팩스",
      // Fax is priced per page; show page count to match the per-page unit price.
      count: row.faxPageCount,
      unitPriceKrw: rateFax,
      amountKrw: row.faxAmountKrw,
    });
  }
  return items;
}

/**
 * Invoice document for a single organization, shown in the preview modal. The markup mirrors
 * the admin prototype (docs/prototype/admin/usage.dc.html) invoice preview (.iv-*). The PDF
 * download (InvoicePdf) draws the same data with the same helpers, so keep the two in step.
 */
export function InvoiceDocument({
  row,
  month,
  config,
  settings,
}: {
  row: PlatformOrgBilling;
  month: string;
  config: InvoiceConfig;
  settings: PlatformSettings | undefined;
}) {
  const items = lineItems(row, settings);
  const supply = row.subtotalKrw;
  const vat = row.vatKrw;
  const total = row.totalKrw;

  return (
    <div className="mx-auto w-full max-w-[640px] bg-white px-[34px] py-8 leading-[normal] text-t1">
      {/* Header: 발행처(본사) */}
      <div className="flex items-start gap-[14px] border-b-2 border-t1 pb-5">
        <div>
          <div className="text-[20px] font-extrabold tracking-[-0.03em]">발송비 청구서</div>
          <div className="mt-1.5 text-[12.5px] font-semibold text-t3 num">
            {invoiceNo(month, row.orgId)} · 발행일 {todayLabel()}
          </div>
        </div>
        <div className="ml-auto text-right text-[12px] font-semibold leading-[1.7] text-t3">
          <b className="mb-0.5 block text-[13.5px] font-extrabold text-t1">{config.accountHolder}</b>
          사업자등록번호 {config.businessRegNo}
          <br />
          담당 {config.contactPerson}
        </div>
      </div>

      {/* 수신(업체) */}
      <div className="flex items-baseline gap-2.5 pb-4 pt-[18px]">
        <div className="text-[17px] font-extrabold tracking-[-0.02em]">{row.orgName}</div>
        <div className="text-[12.5px] font-semibold text-t3">{periodLabel(month)}</div>
      </div>

      {/* 항목표 */}
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="border-y border-line py-[9px] text-left text-[12px] font-bold text-t3">항목</th>
            <th className="border-y border-line py-[9px] text-right text-[12px] font-bold text-t3">발송 건수</th>
            <th className="border-y border-line py-[9px] text-right text-[12px] font-bold text-t3">단가</th>
            <th className="border-y border-line py-[9px] text-right text-[12px] font-bold text-t3">금액</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td className="border-b border-line2 py-[11px] text-t3" colSpan={4}>
                청구할 발송 내역이 없습니다.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.name}>
                <td className="border-b border-line2 py-[11px] font-bold text-t1">{item.name}</td>
                <td className="border-b border-line2 py-[11px] text-right font-semibold text-t2 num">
                  {num(item.count)}건
                </td>
                <td className="border-b border-line2 py-[11px] text-right font-semibold text-t2 num">
                  {num(item.unitPriceKrw)}원
                </td>
                <td className="border-b border-line2 py-[11px] text-right font-semibold text-t2 num">
                  {num(item.amountKrw)}원
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* 합계 */}
      <div className="ml-auto mt-4 flex w-[280px] flex-col gap-[9px]">
        <div className="flex items-center text-[13px] font-semibold text-t3">
          공급가액<span className="ml-auto font-bold text-t2 num">{num(supply)}원</span>
        </div>
        <div className="flex items-center text-[13px] font-semibold text-t3">
          부가세 ({invoiceVatRate(row, config)}%)<span className="ml-auto font-bold text-t2 num">{num(vat)}원</span>
        </div>
        <div className="flex items-center border-t-2 border-t1 pt-[11px] text-[15px] font-extrabold text-t1">
          청구 합계<span className="ml-auto text-[18px] font-extrabold text-blue num">{num(total)}원</span>
        </div>
      </div>

      {/* 입금 계좌 */}
      <div className="mt-6 rounded-xl bg-bg px-[18px] py-4">
        <div className="mb-2 text-[12px] font-bold text-t3">
          입금 계좌 · 기한 {config.due}
        </div>
        <div className="text-[15px] font-extrabold tracking-[-0.01em] num">
          {config.account}
        </div>
        <div className="mt-1 text-[12.5px] font-semibold text-t3">예금주 {config.accountHolder}</div>
      </div>

      {/* 안내 문구 */}
      {config.notice && <div className="mt-3.5 text-[12px] font-semibold leading-[1.6] text-t4">{config.notice}</div>}
    </div>
  );
}
