"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import { PartnerMobileHeader } from "../../../_components/PartnerMobileHeader";
import { AS_STATUS, combineDateTime, todayLocal } from "../_as";
import styles from "../_asform.module.css";

type Building = { id: number; name: string };
type Unit = { unit_id: number; unit_no: string; dong: string | null; phone: string | null };
type Cat = { id: number; label: string };

function unitLabel(u: Unit) {
  return `${u.dong ? `${u.dong} ` : ""}${u.unit_no}`;
}

export default function PartnerAsNewPage() {
  const router = useRouter();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [myName, setMyName] = useState("");
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);

  const [buildingId, setBuildingId] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("pending");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [result, setResult] = useState("");

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReg, setConfirmReg] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const supabase = createClient();
      const [{ data: b }, { data: c }, { data: p }] = await Promise.all([
        supabase.rpc("partner_list_buildings"),
        supabase.rpc("partner_list_as_categories"),
        supabase.rpc("partner_get_profile"),
      ]);
      if (!alive) return;
      const bl = Array.isArray(b) ? (b as Building[]) : [];
      setBuildings(bl);
      setCats(Array.isArray(c) ? (c as Cat[]) : []);
      const prof = Array.isArray(p) ? p[0] : p;
      setMyName(prof?.full_name ?? "");
      setToday(todayLocal());
      if (bl.length) setBuildingId(String(bl[0].id));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!buildingId) return;
    let alive = true;
    void (async () => {
      const { data } = await createClient().rpc("partner_list_units", { p_building_id: Number(buildingId) });
      if (!alive) return;
      setUnits(Array.isArray(data) ? (data as Unit[]) : []);
      setUnitId("");
    })();
    return () => {
      alive = false;
    };
  }, [buildingId]);

  const selectedUnit = units.find((u) => String(u.unit_id) === unitId);
  const reporterPhone = selectedUnit?.phone ?? "";

  const register = async () => {
    if (busy) return;
    setErr("");
    if (!buildingId) {
      setErr("건물을 선택해 주세요");
      return;
    }
    if (!content.trim()) {
      setErr("접수 내용을 입력해 주세요");
      return;
    }
    setBusy(true);
    const { error } = await createClient().rpc("partner_create_complaint", {
      p_building_id: Number(buildingId),
      p_unit_id: unitId ? Number(unitId) : null,
      p_category_id: categoryId ? Number(categoryId) : null,
      p_content: content.trim(),
      p_status: status,
      p_completed_at: combineDateTime(date, time),
      p_result_content: result.trim(),
      p_reporter_phone: reporterPhone,
    });
    if (error) {
      setErr("접수 등록에 실패했어요. 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    router.push("/partner/mobile-home");
  };

  const header = <PartnerMobileHeader title="신규 접수" onBack={() => setConfirmCancel(true)} variant="compact" />;

  if (loading) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none}>불러오는 중…</div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.scroll}>
        <div className={styles.sec}>
          <div className={styles.secTitle}>대상 세대</div>
          <div className={styles.box}>
            <div className={styles.row}>
              <span className={styles.label}>건물</span>
              <select className={styles.control} value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
                {buildings.length === 0 && <option value="">담당 건물 없음</option>}
                {buildings.map((b) => (
                  <option key={b.id} value={String(b.id)}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>호수</span>
              <select className={styles.control} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">건물 전체</option>
                {units.map((u) => (
                  <option key={u.unit_id} value={String(u.unit_id)}>{unitLabel(u)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>접수 정보</div>
          <div className={styles.box}>
            <div className={styles.row}>
              <span className={styles.label}>접수자</span>
              <span className={styles.ro}>{myName || "—"}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>담당자</span>
              <span className={styles.ro}>{myName || "—"}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>접수일시</span>
              <span className={styles.ro}>{today}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>유형</span>
              <select className={styles.control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">선택 안 함</option>
                {cats.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>입주자 전화번호</span>
              <span className={styles.ro}>{reporterPhone || "—"}</span>
            </div>
            <div className={`${styles.row} ${styles.rowCol}`}>
              <span className={styles.label}>접수 내용</span>
              <textarea className={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} placeholder="접수 내용을 입력해 주세요" />
            </div>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>처리</div>
          <div className={styles.box}>
            <div className={styles.row}>
              <span className={styles.label}>처리결과</span>
              <select className={styles.control} value={status} onChange={(e) => setStatus(e.target.value)}>
                {AS_STATUS.map((s) => (
                  <option key={s.db} value={s.db}>{s.ko}</option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>시행일자</span>
              <input type="date" className={styles.control} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className={styles.row}>
              <span className={styles.label}>시간</span>
              <input type="time" className={styles.control} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className={`${styles.row} ${styles.rowCol}`}>
              <span className={styles.label}>처리결과 내용</span>
              <textarea className={styles.textarea} value={result} onChange={(e) => setResult(e.target.value)} placeholder="처리한 내용을 입력해 주세요" />
            </div>
          </div>
        </div>

        {err && <div className={styles.err} role="alert">{err}</div>}
      </div>

      <PartnerBottomActionBar>
        <button type="button" className={`${styles.btn} ${styles.btnSec}`} onClick={() => setConfirmCancel(true)} disabled={busy}>취소</button>
        <button type="button" className={`${styles.btn} ${styles.btnPri}`} onClick={() => setConfirmReg(true)} disabled={busy}>접수 등록</button>
      </PartnerBottomActionBar>

      {confirmReg && (
        <div className={styles.scrim} onClick={(e) => e.target === e.currentTarget && setConfirmReg(false)}>
          <div className={styles.dialog}>
            <div className={styles.dTitle}>접수를 등록할까요?</div>
            <div className={styles.dDesc}>입력한 내용으로 A/S 접수가 등록돼요.</div>
            <div className={styles.dActions}>
              <button type="button" className={`${styles.dBtn} ${styles.dCancel}`} onClick={() => setConfirmReg(false)}>취소</button>
              <button type="button" className={`${styles.dBtn} ${styles.dOk}`} onClick={() => { setConfirmReg(false); void register(); }} disabled={busy}>등록</button>
            </div>
          </div>
        </div>
      )}

      {confirmCancel && (
        <div className={styles.scrim} onClick={(e) => e.target === e.currentTarget && setConfirmCancel(false)}>
          <div className={styles.dialog}>
            <div className={styles.dTitle}>작성을 취소할까요?</div>
            <div className={styles.dDesc}>입력한 내용은 저장되지 않아요.</div>
            <div className={styles.dActions}>
              <button type="button" className={`${styles.dBtn} ${styles.dCancel}`} onClick={() => setConfirmCancel(false)}>계속 작성</button>
              <button type="button" className={`${styles.dBtn} ${styles.dDanger}`} onClick={() => router.push("/partner/mobile-home")}>나가기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
