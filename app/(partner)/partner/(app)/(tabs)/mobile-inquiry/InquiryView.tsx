"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import styles from "./mobile-inquiry.module.css";

export type BuildingRow = {
  id: number;
  code: string;
  name: string;
  address: string | null;
  total_units: number;
  occupied_units: number;
};

export type TenantRow = {
  unit_id: number;
  building_id: number;
  building_name: string;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  phone: string | null;
  move_in_date: string | null;
};

function unitLabel(dong: string | null, unitNo: string) {
  return `${dong ? `${dong} ` : ""}${unitNo}`;
}

function telHref(v: string) {
  return `tel:${v.replace(/[^0-9]/g, "")}`;
}

const TelIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z" />
  </svg>
);

export function InquiryView({ buildings, tenants }: { buildings: BuildingRow[]; tenants: TenantRow[] }) {
  const [tab, setTab] = useState<"bld" | "ten">("bld");
  const [q, setQ] = useState("");
  const kw = q.trim().toLowerCase();

  const bList = useMemo(
    () => buildings.filter((b) => !kw || `${b.name} ${b.address ?? ""}`.toLowerCase().includes(kw)),
    [buildings, kw],
  );
  const tList = useMemo(
    () =>
      tenants.filter(
        (t) => !kw || `${t.tenant_name ?? ""} ${t.building_name} ${t.phone ?? ""}`.toLowerCase().includes(kw),
      ),
    [tenants, kw],
  );

  const empty = tab === "bld" ? bList.length === 0 : tList.length === 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>조회</div>

      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <input
          className={styles.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "bld" ? "건물명 검색" : "입주자명 또는 전화번호 검색"}
          aria-label="검색"
        />
      </div>

      <div className={styles.tabs}>
        <button type="button" className={`${styles.tab} ${tab === "bld" ? styles.tabOn : ""}`} onClick={() => setTab("bld")}>
          건물
        </button>
        <button type="button" className={`${styles.tab} ${tab === "ten" ? styles.tabOn : ""}`} onClick={() => setTab("ten")}>
          입주자
        </button>
      </div>

      <div className={styles.scroll}>
        {empty ? (
          <div className={styles.none}>검색 결과가 없어요</div>
        ) : tab === "bld" ? (
          <div className={styles.list}>
            {bList.map((b) => (
              <Link key={b.id} href={`/partner/mobile-building?id=${b.id}`} className={styles.bcard}>
                <div className={styles.bmain}>
                  <div className={styles.bname}>{b.name}</div>
                  {b.address && <div className={styles.baddr}>{b.address}</div>}
                </div>
                <svg className={styles.chev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.list}>
            {tList.map((t) => (
              <div key={t.unit_id} className={styles.tcard}>
                <div className={styles.tname}>{t.tenant_name ?? "공실"}</div>
                <div className={styles.taddr}>
                  {t.building_name} {unitLabel(t.dong, t.unit_no)}
                </div>
                {t.phone && (
                  <div className={styles.trow}>
                    <span className={styles.trowLabel}>연락처</span>
                    <a className={styles.tel} href={telHref(t.phone)}>
                      <TelIcon />
                      {t.phone}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
