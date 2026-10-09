"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

import { formatDate, formatMonth, formatWon } from "@/lib/format";
import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import { PartnerPhoneLink } from "../../../_components/PartnerPhoneLink";
import { tenantClasses as styles } from "./tenantClasses";
import type { MobileTenantData, MovingSettlement } from "./types";

type Tab = "info" | "pay" | "ms";

const METHOD_LABEL: Record<string, string> = {
  cash: "현금",
  transfer: "계좌이체",
  auto_debit: "자동이체",
  giro: "지로",
  card: "카드",
  other: "기타",
};

function unitLabel(dong: string | null, unitNo: string) {
  return `${dong ? `${dong} ` : ""}${unitNo}`;
}
function fmtDate(iso: string | null) {
  return formatDate(iso, { nullText: "" });
}
function fmtMonth(iso: string) {
  return formatMonth(iso, { nullText: "" });
}
function won(n: number) {
  return `${n < 0 ? "-" : ""}${formatWon(Math.abs(n))}`;
}
function methodsLabel(csv: string | null) {
  if (!csv) return "";
  return csv
    .split(",")
    .map((m) => METHOD_LABEL[m.trim()] ?? m.trim())
    .filter(Boolean)
    .join(", ");
}

function Row({
  label,
  children,
  valueClassName = styles.rowValue,
}: {
  label: string;
  children: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <b className={valueClassName}>{children}</b>
    </div>
  );
}

// 이사정산 카드 금액(정본 .amt2 수납액 | 미수금). 수납액 = 파트너 이사정산 등록 화면이 저장한 값(extra.paid),
// 미수금 = 정산 금액(공과금·관리비·기타·청소 합계) − 수납액 — 등록 화면 하단 미수금과 같은 식이다.
function settlementAmounts(s: MovingSettlement) {
  return { paid: s.paid_amount, due: (s.settlement_amount ?? 0) - s.paid_amount };
}

export function MobileTenantWorkspace({ data }: { data: MobileTenantData }) {
  const { occupancy: occ, payments: pay, settlements } = data;
  const [tab, setTab] = useState<Tab>("info");
  const [openPeriods, setOpenPeriods] = useState<Set<string>>(new Set());

  const togglePeriod = (period: string) =>
    setOpenPeriods((prev) => {
      const next = new Set(prev);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });

  const backHref = occ ? `/partner/mobile-building?id=${occ.building_id}` : "/partner/mobile-inquiry";

  const header = (
    <PartnerMobileHeader
      title={occ ? `${unitLabel(occ.dong, occ.unit_no)}${occ.tenant_name ? ` · ${occ.tenant_name}` : ""}` : "입주자"}
      backHref={backHref}
      subtitle={occ ? occ.building_name : null}
      action={
        occ ? (
          <Link href={`/partner/mobile-ms-new?unitId=${occ.unit_id}`} className={styles.msBtn}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            이사정산 등록
          </Link>
        ) : undefined
      }
    />
  );

  if (!occ) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none}>세대 정보를 찾을 수 없어요</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === "info" ? styles.tabActive : styles.tabIdle}`} onClick={() => setTab("info")}>
          입주자 정보
        </button>
        <button type="button" className={`${styles.tab} ${tab === "pay" ? styles.tabActive : styles.tabIdle}`} onClick={() => setTab("pay")}>
          수납정보
        </button>
        <button type="button" className={`${styles.tab} ${tab === "ms" ? styles.tabActive : styles.tabIdle}`} onClick={() => setTab("ms")}>
          이사정산 <span className={styles.count}>{settlements.length}</span>
        </button>
      </div>

      <div className={styles.scroll}>
        {tab === "info" && (
          <div className={styles.pad}>
            <div className={styles.sectionTitle}>입주자 정보</div>
            <div className={styles.sec}>
              <Row label="건물명">{occ.building_name}</Row>
              <Row label="호수">
                <span className={styles.num}>{unitLabel(occ.dong, occ.unit_no)}</span>
              </Row>
              <div className={styles.row}>
                <span className={styles.rowLabel}>입주자명</span>
                {occ.tenant_name ? <b className={styles.rowValue}>{occ.tenant_name}</b> : <span className={styles.uvac}>공실</span>}
              </div>
              <Row label="입주일">
                {occ.move_in_date ? (
                  <span className={styles.num}>{fmtDate(occ.move_in_date)}</span>
                ) : (
                  <span className={styles.empty}>—</span>
                )}
              </Row>
            </div>

            <div className={styles.sectionTitle}>연락처</div>
            <div className={styles.sec}>
              {[occ.phone, ...occ.phones_more].filter((phone): phone is string => Boolean(phone)).map((phone, index) => (
                <div key={`${phone}-${index}`} className={styles.row}>
                  <span className={styles.rowLabel}>{index === 0 ? "전화번호" : "부번호"}</span>
                  <PartnerPhoneLink
                    phone={phone}
                    pushRight
                  />
                </div>
              ))}
              {[occ.phone, ...occ.phones_more].every((phone) => !phone) ? (
                <div className={styles.row}>
                  <span className={styles.rowLabel}>전화번호</span>
                  <span className={styles.muted}>등록된 연락처가 없어요</span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {tab === "pay" && (
          <div className={styles.padTight}>
            {pay.length === 0 ? (
              <div className={styles.none}>수납 내역이 없어요</div>
            ) : (
              pay.map((p) => {
                const open = openPeriods.has(p.period);
                return (
                  <div key={p.period} className={`${styles.pcell} ${open ? styles.pcellOpen : ""}`}>
                    <button type="button" className={styles.ptop} onClick={() => togglePeriod(p.period)}>
                      <div className={styles.ptopMain}>
                        <span className={styles.pmonth}>{fmtMonth(p.period)}</span>
                        <span className={styles.pdue}>기한 {p.due_date ? fmtDate(p.due_date) : "-"}</span>
                      </div>
                      <span className={styles.pamt}>{won(p.charged)}</span>
                      <svg className={styles.pchev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {open && (
                      <div className={styles.pdet}>
                        <div className={styles.pdetSec}>
                          <Row label="연체" valueClassName={styles.pdetValue}>
                            {p.unpaid > 0 ? <span className={styles.neg}>{won(p.unpaid)}</span> : <span className={styles.empty}>-</span>}
                          </Row>
                          <Row label="수납액" valueClassName={styles.pdetValue}>
                            <span className={styles.num}>{won(p.paid)}</span>
                          </Row>
                          <Row label="수납일자" valueClassName={styles.pdetValue}>
                            {p.last_paid_at ? (
                              <span className={styles.num}>{fmtDate(p.last_paid_at)}</span>
                            ) : (
                              <span className={styles.empty}>—</span>
                            )}
                          </Row>
                          <Row label="구분" valueClassName={styles.pdetValue}>
                            {methodsLabel(p.methods) || <span className={styles.empty}>—</span>}
                          </Row>
                          <Row label="비고" valueClassName={styles.pdetValue}>
                            <span className={styles.pdetMemo}>{p.memo || "—"}</span>
                          </Row>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "ms" && (
          <div className={styles.pad}>
            {settlements.length === 0 ? (
              <div className={styles.none}>이사정산 내역이 없어요</div>
            ) : (
              settlements.map((s, i) => {
                const done = s.status === "completed";
                const { paid, due } = settlementAmounts(s);
                return (
                  <Link
                    key={s.id}
                    href={`/partner/mobile-ms-new?unitId=${occ.unit_id}&settlementId=${s.id}`}
                    className={styles.mscard}
                  >
                    <div className={styles.mstop}>
                      <span className={styles.msname}>
                        No.{settlements.length - i} {s.tenant_name || occ.tenant_name || "—"}
                      </span>
                      <span className={`${styles.chip} ${done ? styles.chipOk : styles.chipNo}`}>{done ? "완료" : "미결"}</span>
                      <span className={styles.msSpacer} />
                      <svg className={styles.mchev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <div className={styles.msamt2}>
                      <div className={styles.msamtPaid}>
                        <span className={styles.msamtLabel}>수납액</span>
                        <b className={styles.msamtVal}>{won(paid)}</b>
                      </div>
                      <div className={styles.msamtDue}>
                        <span className={styles.msamtLabel}>미수금</span>
                        <b className={due !== 0 ? styles.msamtValNeg : styles.msamtVal}>{won(due)}</b>
                      </div>
                    </div>
                    <div className={styles.msdrow}>
                      <span className={styles.msdate}>
                        등록일자 <b className={styles.msdateVal}>{fmtDate(s.created_at) || "—"}</b>
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
