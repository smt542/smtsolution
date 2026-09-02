"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useState } from "react";

import { formatDate, formatMonth, formatWon } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import styles from "./mobile-tenant.module.css";

type Occ = {
  unit_id: number;
  building_id: number;
  building_name: string;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  payer_name: string | null;
  phone: string | null;
  resident_count: number | null;
  vehicle_no: string | null;
  move_in_date: string | null;
  status: string;
};

type PayRow = {
  period: string;
  due_date: string | null;
  charged: number;
  paid: number;
  unpaid: number;
  last_paid_at: string | null;
  methods: string | null;
  memo: string | null;
};

type Settlement = {
  id: number;
  tenant_name: string | null;
  status: string;
  settlement_amount: number | null;
  move_out_date: string | null;
  created_at: string;
};

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
function telHref(v: string) {
  return `tel:${v.replace(/[^0-9]/g, "")}`;
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <b className={styles.rowValue}>{children}</b>
    </div>
  );
}

function TenantDetailInner() {
  const sp = useSearchParams();
  const idStr = sp.get("id");
  const unitId = idStr ? Number(idStr) : NaN;
  const [occ, setOcc] = useState<Occ | null>(null);
  const [pay, setPay] = useState<PayRow[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("info");
  const [openPeriods, setOpenPeriods] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!Number.isFinite(unitId)) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [{ data: o }, { data: p }, { data: s }] = await Promise.all([
        supabase.rpc("partner_get_occupancy", { p_unit_id: unitId }),
        supabase.rpc("partner_list_unit_payments", { p_unit_id: unitId }),
        supabase.rpc("partner_list_unit_settlements", { p_unit_id: unitId }),
      ]);
      if (!alive) return;
      setOcc((Array.isArray(o) ? o[0] : o) ?? null);
      setPay(Array.isArray(p) ? (p as PayRow[]) : []);
      setSettlements(Array.isArray(s) ? (s as Settlement[]) : []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [unitId]);

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

  if (loading) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none}>불러오는 중…</div>
      </div>
    );
  }
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
        <button type="button" className={`${styles.tab} ${tab === "info" ? styles.tabOn : ""}`} onClick={() => setTab("info")}>
          입주자 정보
        </button>
        <button type="button" className={`${styles.tab} ${tab === "pay" ? styles.tabOn : ""}`} onClick={() => setTab("pay")}>
          수납정보
        </button>
        <button type="button" className={`${styles.tab} ${tab === "ms" ? styles.tabOn : ""}`} onClick={() => setTab("ms")}>
          이사정산 <span className={styles.count}>{settlements.length}</span>
        </button>
      </div>

      <div className={styles.scroll}>
        {tab === "info" && (
          <div className={styles.pad}>
            <div className={styles.sectionTitle}>입주자 정보</div>
            <div className={styles.sec}>
              <Row label="건물명">{occ.building_name}</Row>
              <Row label="호수">{unitLabel(occ.dong, occ.unit_no)}</Row>
              <div className={styles.row}>
                <span className={styles.rowLabel}>입주자명</span>
                {occ.tenant_name ? <b className={styles.rowValue}>{occ.tenant_name}</b> : <span className={styles.uvac}>공실</span>}
              </div>
              <Row label="입주일">{fmtDate(occ.move_in_date) || "—"}</Row>
            </div>

            <div className={styles.sectionTitle}>연락처</div>
            <div className={styles.sec}>
              <div className={styles.row}>
                <span className={styles.rowLabel}>전화번호</span>
                {occ.phone ? (
                  <a className={styles.tel} href={telHref(occ.phone)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                      <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z" />
                    </svg>
                    {occ.phone}
                  </a>
                ) : (
                  <span className={styles.muted}>등록된 연락처가 없어요</span>
                )}
              </div>
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
                        <span className={styles.pdue}>기한 {p.due_date ? fmtDate(p.due_date) : "—"}</span>
                      </div>
                      <span className={styles.pamt}>{won(p.charged)}</span>
                      <svg className={styles.pchev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {open && (
                      <div className={styles.pdet}>
                        <div className={styles.sec}>
                          <Row label="연체">
                            {p.unpaid > 0 ? <span className={styles.neg}>{won(p.unpaid)}</span> : <span className={styles.muted}>—</span>}
                          </Row>
                          <Row label="수납액">{won(p.paid)}</Row>
                          <Row label="수납일자">{p.last_paid_at ? fmtDate(p.last_paid_at) : "—"}</Row>
                          <Row label="구분">{methodsLabel(p.methods) || "—"}</Row>
                          <Row label="비고">{p.memo || "—"}</Row>
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
                return (
                  <Link
                    key={s.id}
                    href={`/partner/mobile-ms-new?unitId=${occ.unit_id}&settlementId=${s.id}`}
                    className={styles.mscard}
                    style={{ display: "block" }}
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
                    <div className={styles.msamtRow}>
                      <span className={styles.msamtLabel}>정산액</span>
                      <b className={styles.msamtVal}>{won(s.settlement_amount ?? 0)}</b>
                    </div>
                    <div className={styles.msmeta}>
                      <span>
                        퇴실일 <b>{s.move_out_date ? fmtDate(s.move_out_date) : "—"}</b>
                      </span>
                      <span>
                        등록일자 <b>{fmtDate(s.created_at) || "—"}</b>
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

export default function PartnerTenantPage() {
  return (
    <Suspense fallback={<div className={styles.root} />}>
      <TenantDetailInner />
    </Suspense>
  );
}
