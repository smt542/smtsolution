"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { formatMonth } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import { PartnerConfirmDialog } from "../../../_components/PartnerConfirmDialog";
import styles from "./mobile-meter.module.css";

type Meter = { prev: string; cur: string };
type UnitRow = {
  unit_id: number;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  meters: Record<string, Meter>;
};
type RawRow = {
  unit_id: number;
  unit_no: string;
  dong: string | null;
  tenant_name: string | null;
  utility: string;
  previous_reading: number | null;
  current_reading: number | null;
};

const KIND = [
  { k: "water", l: "수도", u: "㎥" },
  { k: "elec", l: "전기", u: "kWh" },
  { k: "gas", l: "가스", u: "㎥" },
];

const pad = (n: number) => String(n).padStart(2, "0");

function unitLabel(dong: string | null, unitNo: string) {
  return `${dong ? `${dong} ` : ""}${unitNo}`;
}

function group(rows: RawRow[]): UnitRow[] {
  const map = new Map<number, UnitRow>();
  for (const r of rows) {
    let u = map.get(r.unit_id);
    if (!u) {
      u = { unit_id: r.unit_id, unit_no: r.unit_no, dong: r.dong, tenant_name: r.tenant_name, meters: {} };
      map.set(r.unit_id, u);
    }
    u.meters[r.utility] = {
      prev: r.previous_reading != null ? String(r.previous_reading) : "",
      cur: r.current_reading != null ? String(r.current_reading) : "",
    };
  }
  return [...map.values()];
}

function usageOf(m: Meter | undefined) {
  if (!m) return "";
  const p = parseFloat(m.prev);
  const c = parseFloat(m.cur);
  if (!isFinite(p) || !isFinite(c)) return "";
  return String(Math.max(0, c - p));
}

function MeterInner() {
  const sp = useSearchParams();
  const idStr = sp.get("id");
  const buildingId = idStr ? Number(idStr) : NaN;

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
  const [buildingName, setBuildingName] = useState("");
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!Number.isFinite(buildingId)) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const supabase = createClient();
      const [{ data: b }, { data: r }] = await Promise.all([
        supabase.rpc("partner_get_building", { p_building_id: buildingId }),
        supabase.rpc("partner_list_meter_readings", { p_building_id: buildingId, p_period: `${month}-01` }),
      ]);
      if (!alive) return;
      const bb = Array.isArray(b) ? b[0] : b;
      setBuildingName(bb?.name ?? "");
      setUnits(group(Array.isArray(r) ? (r as RawRow[]) : []));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [buildingId, month]);

  const setMeter = (unitId: number, util: string, field: "prev" | "cur", val: string) => {
    const v = val.replace(/[^0-9.]/g, "");
    setUnits((prev) =>
      prev.map((u) =>
        u.unit_id === unitId
          ? { ...u, meters: { ...u.meters, [util]: { ...(u.meters[util] ?? { prev: "", cur: "" }), [field]: v } } }
          : u,
      ),
    );
  };

  const toggle = (unitId: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    const readings = units.flatMap((u) =>
      KIND.map((kd) => ({
        unit_id: u.unit_id,
        utility: kd.k,
        previous_reading: u.meters[kd.k]?.prev ?? "",
        current_reading: u.meters[kd.k]?.cur ?? "",
      })),
    );
    const { error } = await createClient().rpc("partner_save_meter_readings", {
      p_building_id: buildingId,
      p_period: `${month}-01`,
      p_readings: readings,
    });
    setBusy(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1700);
    }
  };

  const doneCount = units.filter((u) => KIND.some((kd) => (u.meters[kd.k]?.cur ?? "") !== "")).length;

  const header = (
    <div className={styles.header}>
      <Link href={Number.isFinite(buildingId) ? `/partner/mobile-building?id=${buildingId}` : "/partner/mobile-inquiry"} className={styles.back} aria-label="뒤로">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <div className={styles.titleWrap}>
        <div className={styles.title}>검침 자료</div>
        {buildingName && <div className={styles.sub}>{buildingName}</div>}
      </div>
    </div>
  );

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.bar}>
        <input type="month" className={styles.month} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="검침 년월" />
        <span className={`${styles.count} ${doneCount === 0 ? styles.countZero : ""}`}>
          {doneCount} / {units.length}세대 입력
        </span>
      </div>

      <div className={styles.scroll}>
        {loading ? (
          <div className={styles.none}>불러오는 중…</div>
        ) : units.length === 0 ? (
          <div className={styles.none}>세대 정보가 없어요</div>
        ) : (
          units.map((u) => {
            const isOpen = open.has(u.unit_id);
            const filled = KIND.some((kd) => (u.meters[kd.k]?.cur ?? "") !== "");
            return (
              <div key={u.unit_id} className={`${styles.ucell} ${isOpen ? styles.ucellOpen : ""}`}>
                <button type="button" className={styles.uhead} onClick={() => toggle(u.unit_id)}>
                  <span className={styles.uho}>{unitLabel(u.dong, u.unit_no)}</span>
                  <span className={styles.unm}>{u.tenant_name ?? "공실"}</span>
                  <span className={`${styles.ust} ${filled ? styles.ustOn : ""}`}>{filled ? "입력완료" : "미입력"}</span>
                  <svg className={styles.uchev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isOpen && (
                  <div className={styles.ubody}>
                    {KIND.map((kd) => {
                      const m = u.meters[kd.k] ?? { prev: "", cur: "" };
                      return (
                        <div key={kd.k} className={styles.grp}>
                          <div className={styles.grpT}>
                            {kd.l} <em>{kd.u}</em>
                          </div>
                          <div className={styles.g3}>
                            <label className={styles.fld}>
                              <span>전월</span>
                              <input className={styles.fin} inputMode="decimal" placeholder="0" value={m.prev} onChange={(e) => setMeter(u.unit_id, kd.k, "prev", e.target.value)} />
                            </label>
                            <label className={styles.fld}>
                              <span>금월</span>
                              <input className={styles.fin} inputMode="decimal" placeholder="0" value={m.cur} onChange={(e) => setMeter(u.unit_id, kd.k, "cur", e.target.value)} />
                            </label>
                            <div className={styles.fld}>
                              <span>사용량</span>
                              <div className={styles.usage}>{usageOf(m) || "-"}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <PartnerBottomActionBar>
        <button type="button" className={styles.btn} onClick={() => setConfirm(true)} disabled={busy || loading || units.length === 0}>
          {saved ? "저장했어요" : "저장"}
        </button>
      </PartnerBottomActionBar>

      {confirm && (
        <PartnerConfirmDialog
          title="검침 자료를 저장할까요?"
          description={<>{formatMonth(month)} 검침 내용이 저장돼요.</>}
          cancelLabel="취소"
          confirmLabel="저장"
          onCancel={() => setConfirm(false)}
          onConfirm={() => { setConfirm(false); void save(); }}
          confirmDisabled={busy}
        />
      )}
    </div>
  );
}

export default function PartnerMeterPage() {
  return (
    <Suspense fallback={<div className={styles.root} />}>
      <MeterInner />
    </Suspense>
  );
}
