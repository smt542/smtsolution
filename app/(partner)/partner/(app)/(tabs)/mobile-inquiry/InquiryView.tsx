"use client";

import { useMemo, useState } from "react";

import { PartnerListRow } from "../../../../_components/PartnerListRow";
import { PartnerPhoneLink } from "../../../../_components/PartnerPhoneLink";
import { inquiryClasses as styles } from "./inquiryClasses";

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
              <PartnerListRow key={b.id} href={`/partner/mobile-building?id=${b.id}`} chevron>
                <div className={styles.bmain}>
                  <div className={styles.bname}>{b.name}</div>
                  {b.address && <div className={styles.baddr}>{b.address}</div>}
                </div>
              </PartnerListRow>
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
                    <PartnerPhoneLink phone={t.phone} pushRight />
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
