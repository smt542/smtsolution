"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import { AS_STATUS, combineDateTime, fmtDateTime, splitDateTime } from "../_as";
import styles from "../_asform.module.css";

type Detail = {
  id: number;
  building_name: string;
  unit_label: string | null;
  category_id: number | null;
  content: string | null;
  status: string;
  reporter_phone: string | null;
  logger_name: string | null;
  assigned_name: string | null;
  received_at: string;
  completed_at: string | null;
  result_content: string | null;
  is_mine: boolean;
};
type Cat = { id: number; label: string };

function AsDetailInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const idStr = sp.get("id");
  const id = idStr ? Number(idStr) : NaN;

  const [d, setD] = useState<Detail | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  const [categoryId, setCategoryId] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("pending");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [result, setResult] = useState("");

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!Number.isFinite(id)) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [{ data: det }, { data: c }] = await Promise.all([
        supabase.rpc("partner_get_complaint", { p_id: id }),
        supabase.rpc("partner_list_as_categories"),
      ]);
      if (!alive) return;
      const row = (Array.isArray(det) ? det[0] : det) ?? null;
      setD(row);
      setCats(Array.isArray(c) ? (c as Cat[]) : []);
      if (row) {
        setCategoryId(row.category_id != null ? String(row.category_id) : "");
        setContent(row.content ?? "");
        setStatus(row.status ?? "pending");
        const dt = splitDateTime(row.completed_at);
        setDate(dt.date);
        setTime(dt.time);
        setResult(row.result_content ?? "");
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const save = async () => {
    if (busy) return;
    setErr("");
    if (!content.trim()) {
      setErr("접수 내용을 입력해 주세요");
      return;
    }
    if (!date) {
      setErr("시행일자를 선택해 주세요");
      return;
    }
    setBusy(true);
    const { error } = await createClient().rpc("partner_update_complaint", {
      p_id: id,
      p_category_id: categoryId ? Number(categoryId) : null,
      p_content: content.trim(),
      p_status: status,
      p_completed_at: combineDateTime(date, time),
      p_result_content: result.trim(),
    });
    if (error) {
      setErr("저장에 실패했어요. 다시 시도해 주세요.");
      setBusy(false);
      return;
    }
    router.push("/partner/mobile-home");
  };

  const del = async () => {
    if (busy) return;
    setBusy(true);
    const { error } = await createClient().rpc("partner_delete_complaint", { p_id: id });
    if (error) {
      setErr("삭제에 실패했어요.");
      setBusy(false);
      setConfirmDel(false);
      return;
    }
    router.push("/partner/mobile-home");
  };

  const header = (
    <div className={styles.header}>
      <Link href="/partner/mobile-home" className={styles.back} aria-label="뒤로">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </Link>
      <div className={styles.title}>A/S 상세</div>
    </div>
  );

  if (loading) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none}>불러오는 중…</div>
      </div>
    );
  }
  if (!d) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none}>접수 내역을 찾을 수 없어요</div>
      </div>
    );
  }

  const ro = !d.is_mine;

  return (
    <div className={styles.root}>
      {header}
      <div className={styles.scroll}>
        <div className={styles.sec}>
          <div className={styles.secTitle}>대상 세대</div>
          <div className={styles.box}>
            <div className={styles.row}>
              <span className={styles.label}>건물</span>
              <span className={styles.ro}>{d.building_name}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>호수</span>
              <span className={styles.ro}>{d.unit_label ?? "건물 전체"}</span>
            </div>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>A/S 내용</div>
          <div className={styles.box}>
            <div className={styles.row}>
              <span className={styles.label}>접수자</span>
              <span className={styles.ro}>{d.logger_name ?? "—"}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>담당자</span>
              <span className={styles.ro}>{d.assigned_name ?? "—"}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>접수일시</span>
              <span className={styles.ro}>{fmtDateTime(d.received_at)}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>유형</span>
              <select className={styles.control} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={ro}>
                <option value="">선택 안 함</option>
                {cats.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>입주자 전화번호</span>
              <span className={styles.ro}>{d.reporter_phone ?? "—"}</span>
            </div>
            <div className={`${styles.row} ${styles.rowCol}`}>
              <span className={styles.label}>접수 내용</span>
              <textarea className={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} placeholder="접수 내용을 입력해 주세요" disabled={ro} />
            </div>
          </div>
        </div>

        <div className={styles.sec}>
          <div className={styles.secTitle}>처리</div>
          <div className={styles.box}>
            <div className={styles.row}>
              <span className={styles.label}>처리결과</span>
              <select className={styles.control} value={status} onChange={(e) => setStatus(e.target.value)} disabled={ro}>
                {AS_STATUS.map((s) => (
                  <option key={s.db} value={s.db}>{s.ko}</option>
                ))}
              </select>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>
                시행일자{!ro && <b className={styles.req}>*</b>}
              </span>
              <input type="date" className={styles.control} value={date} onChange={(e) => setDate(e.target.value)} disabled={ro} />
            </div>
            <div className={styles.row}>
              <span className={styles.label}>시간</span>
              <input type="time" className={styles.control} value={time} onChange={(e) => setTime(e.target.value)} disabled={ro} />
            </div>
            <div className={`${styles.row} ${styles.rowCol}`}>
              <span className={styles.label}>처리결과 내용</span>
              <textarea className={styles.textarea} value={result} onChange={(e) => setResult(e.target.value)} placeholder="처리한 내용을 입력해 주세요" disabled={ro} />
            </div>
          </div>
        </div>

        {err && <div className={styles.err} role="alert">{err}</div>}
      </div>

      {ro ? (
        <div className={styles.foot}>
          <div className={styles.note}>담당 건이 아니라 수정할 수 없어요</div>
        </div>
      ) : (
        <div className={styles.foot}>
          <button type="button" className={`${styles.btn} ${styles.btnDel}`} onClick={() => setConfirmDel(true)} disabled={busy}>삭제</button>
          <button type="button" className={`${styles.btn} ${styles.btnPri}`} onClick={() => setConfirmSave(true)} disabled={busy}>저장</button>
        </div>
      )}

      {confirmSave && (
        <div className={styles.scrim} onClick={(e) => e.target === e.currentTarget && setConfirmSave(false)}>
          <div className={styles.dialog}>
            <div className={styles.dTitle}>저장할까요?</div>
            <div className={styles.dDesc}>변경한 내용이 저장돼요.</div>
            <div className={styles.dActions}>
              <button type="button" className={`${styles.dBtn} ${styles.dCancel}`} onClick={() => setConfirmSave(false)}>취소</button>
              <button type="button" className={`${styles.dBtn} ${styles.dOk}`} onClick={() => { setConfirmSave(false); void save(); }} disabled={busy}>저장</button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className={styles.scrim} onClick={(e) => e.target === e.currentTarget && setConfirmDel(false)}>
          <div className={styles.dialog}>
            <div className={styles.dTitle}>접수를 삭제할까요?</div>
            <div className={styles.dDesc}>삭제하면 되돌릴 수 없어요.</div>
            <div className={styles.dActions}>
              <button type="button" className={`${styles.dBtn} ${styles.dCancel}`} onClick={() => setConfirmDel(false)}>취소</button>
              <button type="button" className={`${styles.dBtn} ${styles.dDanger}`} onClick={() => void del()} disabled={busy}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PartnerAsDetailPage() {
  return (
    <Suspense fallback={<div className={styles.root} />}>
      <AsDetailInner />
    </Suspense>
  );
}
