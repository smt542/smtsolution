"use client";

import type { PlatformOrgBilling, PlatformSettings } from "@/hooks/reactquery/platform";

const num = (n: number) => n.toLocaleString("ko-KR");

export interface InvoiceConfig {
  bank: string;
  accountNo: string;
  accountHolder: string;
  businessRegNo: string;
  notice: string;
  dueDays: number;
  vatRate: number;
  contactPerson: string;
}

/**
 * Derive the invoice document config from platform settings, falling back to the
 * prototype's default copy when a field has not been filled in yet.
 */
export function invoiceConfigFromSettings(
  settings: PlatformSettings | undefined,
): InvoiceConfig {
  return {
    bank: settings?.billingBank?.trim() || "농협은행",
    accountNo: settings?.billingAccountNo?.trim() || "-",
    accountHolder: settings?.billingAccountHolder?.trim() || "주식회사 관리비서",
    businessRegNo: settings?.businessRegNo?.trim() || "-",
    notice:
      settings?.invoiceNotice?.trim()
      || "입금 시 업체명으로 입금해 주세요. 세금계산서는 입금 확인 후 발행됩니다.",
    dueDays: settings?.paymentDueDays ?? 14,
    vatRate: settings?.vatRate ?? 10,
    contactPerson: settings?.contactPerson?.trim() || "관리비서 담당",
  };
}

function invoiceNo(month: string, orgId: number): string {
  // month is YYYY-MM-01 → INV-YYYYMM-{orgId}
  const [year, mon] = month.split("-");
  return `INV-${year}${mon}-${String(orgId).padStart(3, "0")}`;
}

function todayLabel(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
}

function periodLabel(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  return `${year}년 ${mon}월 발송분`;
}

interface LineItem {
  name: string;
  count: number;
  unitPriceKrw: number;
  amountKrw: number;
}

function lineItems(row: PlatformOrgBilling, settings: PlatformSettings | undefined): LineItem[] {
  const items: LineItem[] = [];
  if (row.alimtalkCount > 0) {
    items.push({
      name: "알림톡",
      count: row.alimtalkCount,
      unitPriceKrw: settings?.rateKrwAlimtalk ?? 0,
      amountKrw: row.alimtalkAmountKrw,
    });
  }
  // SMS/LMS are billed together on one "문자" line (backend sums them into smsAmountKrw).
  const messageCount = row.smsCount + row.lmsCount;
  if (messageCount > 0) {
    items.push({
      name: "문자",
      count: messageCount,
      unitPriceKrw: settings?.rateKrwSms ?? 0,
      amountKrw: row.smsAmountKrw,
    });
  }
  if (row.faxCount > 0) {
    items.push({
      name: "팩스",
      // Fax is priced per page; show page count to match the per-page unit price.
      count: row.faxPageCount,
      unitPriceKrw: settings?.rateKrwFax ?? 0,
      amountKrw: row.faxAmountKrw,
    });
  }
  return items;
}

/**
 * Pure, print-ready invoice document for a single organization. The markup mirrors
 * the admin prototype (docs/prototype/admin/usage.dc.html) invoice preview. Rendered
 * both inside the preview modal and in the bulk print root, so it must not carry any
 * modal chrome or interactivity.
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
    <div className="mx-auto w-full max-w-[640px] bg-white p-8 text-t1">
      {/* Header: 발행처(본사) */}
      <div className="flex items-start gap-4 border-b-2 border-t1 pb-5">
        <div>
          <div className="text-xl font-extrabold tracking-tight">발송비 청구서</div>
          <div className="mt-1.5 text-xs font-semibold text-t3 num">
            {invoiceNo(month, row.orgId)} · 발행일 {todayLabel()}
          </div>
        </div>
        <div className="ml-auto text-right text-xs font-semibold leading-7 text-t3">
          <b className="mb-0.5 block text-[13.5px] font-extrabold text-t1">{config.accountHolder}</b>
          사업자등록번호 {config.businessRegNo}
          <br />
          담당 {config.contactPerson}
        </div>
      </div>

      {/* 수신(업체) */}
      <div className="flex items-baseline gap-2.5 py-4">
        <div className="text-[17px] font-extrabold tracking-tight">{row.orgName}</div>
        <div className="text-xs font-semibold text-t3">{periodLabel(month)}</div>
      </div>

      {/* 항목표 */}
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="border-y border-line py-2.5 text-left text-xs font-bold text-t3">항목</th>
            <th className="border-y border-line py-2.5 text-right text-xs font-bold text-t3">발송 건수</th>
            <th className="border-y border-line py-2.5 text-right text-xs font-bold text-t3">단가</th>
            <th className="border-y border-line py-2.5 text-right text-xs font-bold text-t3">금액</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td className="border-b border-line2 py-3 text-t3" colSpan={4}>
                청구할 발송 내역이 없습니다.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.name}>
                <td className="border-b border-line2 py-2.5 font-bold text-t1">{item.name}</td>
                <td className="border-b border-line2 py-2.5 text-right font-semibold text-t2 num">
                  {num(item.count)}건
                </td>
                <td className="border-b border-line2 py-2.5 text-right font-semibold text-t2 num">
                  {num(item.unitPriceKrw)}원
                </td>
                <td className="border-b border-line2 py-2.5 text-right font-semibold text-t2 num">
                  {num(item.amountKrw)}원
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* 합계 */}
      <div className="ml-auto mt-4 flex w-[280px] flex-col gap-2.5">
        <div className="flex items-center text-[13px] font-semibold text-t3">
          공급가액<span className="ml-auto font-bold text-t2 num">{num(supply)}원</span>
        </div>
        <div className="flex items-center text-[13px] font-semibold text-t3">
          부가세 ({config.vatRate}%)<span className="ml-auto font-bold text-t2 num">{num(vat)}원</span>
        </div>
        <div className="flex items-center border-t-2 border-t1 pt-2.5 text-[15px] font-extrabold text-t1">
          청구 합계<span className="ml-auto text-lg font-extrabold text-blue num">{num(total)}원</span>
        </div>
      </div>

      {/* 입금 계좌 */}
      <div className="mt-6 rounded-xl bg-bg px-[18px] py-4">
        <div className="mb-2 text-xs font-bold text-t3">
          입금 계좌 · 기한 발행일로부터 {config.dueDays}일
        </div>
        <div className="text-[15px] font-extrabold tracking-tight num">
          {config.bank} {config.accountNo}
        </div>
        <div className="mt-1 text-xs font-semibold text-t3">예금주 {config.accountHolder}</div>
      </div>

      {/* 안내 문구 */}
      <div className="mt-3.5 text-xs font-semibold leading-6 text-t4">{config.notice}</div>
    </div>
  );
}
