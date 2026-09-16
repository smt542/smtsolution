"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { formatDate } from "@/lib/format";

import { homeClasses as styles } from "./homeClasses";

export type AsRow = {
  id: number;
  building_id: number;
  building_name: string;
  unit_label: string | null;
  category_label: string | null;
  title: string;
  content: string | null;
  status: string;
  received_at: string;
  completed_at: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  is_mine: boolean;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "미결", cls: "chip_r" },
  on_hold: { label: "보류", cls: "chip_a" },
  completed: { label: "완결", cls: "chip_g" },
  repeat: { label: "반복", cls: "chip_v" },
};

const FILTERS: { v: string; label: string }[] = [
  { v: "all", label: "전체" },
  { v: "pending", label: "미결" },
  { v: "on_hold", label: "보류" },
  { v: "completed", label: "완결" },
  { v: "repeat", label: "반복" },
];

function fmtDate(iso: string) {
  return formatDate(iso);
}

export function AsList({ rows }: { rows: AsRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [stF, setStF] = useState("all");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [sortOpen, setSortOpen] = useState(false);

  const view = useMemo(() => {
    const kw = q.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (stF !== "all" && r.status !== stF) return false;
      if (kw) {
        const hay = `${r.building_name} ${r.unit_label ?? ""} ${r.content ?? ""} ${r.category_label ?? ""}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
    return [...out].sort((a, b) =>
      sort === "desc"
        ? b.received_at.localeCompare(a.received_at)
        : a.received_at.localeCompare(b.received_at),
    );
  }, [rows, q, stF, sort]);

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>A/S현황 조회</div>
        <Link href="/partner/mobile-as-new" className={styles.newBtn}>＋ 신규 접수</Link>
      </div>

      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <input
          className={styles.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="건물명·호실 검색"
          aria-label="건물명·호실 검색"
        />
      </div>

      <div className={styles.filterRow}>
        <div className={styles.pills}>
          {FILTERS.map((f) => (
            <button
              key={f.v}
              type="button"
              className={`${styles.pill} ${stF === f.v ? styles.pillOn : ""}`}
              onClick={() => setStF(f.v)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.sortBtn} onClick={() => setSortOpen(true)}>
          <span>{sort === "desc" ? "최신순" : "오래된순"}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <div className={styles.scroll}>
        {view.length === 0 ? (
          <div className={styles.none}>해당하는 접수 내역이 없어요</div>
        ) : (
          <div className={styles.list}>
            {view.map((r) => {
              const st = STATUS[r.status] ?? { label: r.status, cls: "chip_r" };
              return (
                <button
                  key={r.id}
                  type="button"
                  className={styles.card}
                  onClick={() => router.push(`/partner/mobile-as?id=${r.id}`)}
                >
                  <div className={styles.cardTop}>
                    {r.category_label && <span className={styles.cat}>{r.category_label}</span>}
                    <span className={styles.gap} />
                    <span className={`${styles.chip} ${styles[st.cls]}`}>{st.label}</span>
                  </div>
                  <div className={styles.place}>
                    {r.building_name}
                    {r.unit_label ? ` ${r.unit_label}` : ""}
                  </div>
                  {r.content && <div className={styles.desc}>{r.content}</div>}
                  <div className={styles.meta}>
                    <span className={styles.num}>{fmtDate(r.received_at)}</span>
                    <span className={`${styles.mgr} ${r.is_mine ? styles.mgrMe : ""}`}>
                      {r.is_mine ? "내 담당" : r.assigned_name ?? "-"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sortOpen && (
        <div
          className={styles.sheet}
          onClick={(e) => e.target === e.currentTarget && setSortOpen(false)}
        >
          <div className={styles.sheetBody}>
            <div className={styles.sheetH}>정렬</div>
            {(["desc", "asc"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className={`${styles.sheetOpt} ${sort === v ? styles.sheetOptOn : ""}`}
                onClick={() => {
                  setSort(v);
                  setSortOpen(false);
                }}
              >
                {v === "desc" ? "최신순" : "오래된순"}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
