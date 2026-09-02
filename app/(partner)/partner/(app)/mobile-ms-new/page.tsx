"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useEffect, useMemo, useState } from "react";

import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import {
  buildSaveData,
  computeTotals,
  deletePartnerSettlement,
  fetchPartnerSettlementContext,
  feeProrated,
  initialState,
  MAX_ETC_ITEMS,
  type MSState,
  type PartnerSettlementContext,
  savePartnerSettlement,
  toNumber,
  utilAmount,
  UTILITY_LABEL,
  utilUsage,
  won,
} from "./_ms";
import styles from "./mobile-ms-new.module.css";

type SectionKey = "basic" | "util" | "fee" | "etc" | "cleaning" | "settle" | "check";

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function ChevronDown({ folded }: { folded: boolean }) {
  return (
    <svg
      className={`${styles.chev} ${folded ? styles.chevFold : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Section({
  title,
  hint,
  folded,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  folded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.sec}>
      <button type="button" className={styles.secHead} onClick={onToggle}>
        <span>{title}</span>
        {hint ? <span className={styles.secHint}>{hint}</span> : null}
        <span className={styles.secSpacer} />
        <ChevronDown folded={folded} />
      </button>
      {folded ? null : children}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      className={className ?? `${styles.control} ${styles.num}`}
      inputMode="numeric"
      value={value ? value.toLocaleString() : ""}
      onChange={(e) => onChange(toNumber(e.target.value))}
      placeholder={placeholder ?? "0"}
    />
  );
}

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

function MsNewInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const unitId = Number(sp.get("unitId"));
  const settlementIdParam = sp.get("settlementId");
  const editId = settlementIdParam ? Number(settlementIdParam) : null;

  const [ctx, setCtx] = useState<PartnerSettlementContext | null>(null);
  const [state, setState] = useState<MSState | null>(null);
  const [activeId, setActiveId] = useState<number | null>(editId);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [confirmKind, setConfirmKind] = useState<null | "save" | "cancel" | "delete">(null);
  const [fold, setFold] = useState<Record<SectionKey, boolean>>({
    basic: false,
    util: true,
    fee: true,
    etc: true,
    cleaning: true,
    settle: true,
    check: true,
  });

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!Number.isFinite(unitId) || unitId <= 0) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      try {
        const context = await fetchPartnerSettlementContext(unitId, editId);
        if (!alive) return;
        setCtx(context);
        const forInit =
          editId === null ? { ...context, latestSettlement: null } : context;
        setState(initialState(forInit));
        setLoading(false);
      } catch {
        if (!alive) return;
        setLoadError(true);
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [unitId, editId]);

  const totals = useMemo(() => (state ? computeTotals(state) : null), [state]);

  const backHref = Number.isFinite(unitId) ? `/partner/mobile-tenant?id=${unitId}` : "/partner/mobile-inquiry";
  const goBack = () => router.push(backHref);
  const isEdit = activeId !== null;

  const patch = (p: Partial<MSState>) => setState((s) => (s ? { ...s, ...p } : s));
  const patchUtil = (i: number, p: Partial<MSState["util"][number]>) =>
    setState((s) => (s ? { ...s, util: s.util.map((u, idx) => (idx === i ? { ...u, ...p } : u)) } : s));
  const patchFee = (i: number, charged: number) =>
    setState((s) =>
      s ? { ...s, feeItems: s.feeItems.map((f, idx) => (idx === i ? { ...f, charged } : f)) } : s,
    );
  const patchEtc = (i: number, p: Partial<MSState["etcItems"][number]>) =>
    setState((s) => (s ? { ...s, etcItems: s.etcItems.map((x, idx) => (idx === i ? { ...x, ...p } : x)) } : s));
  const addEtc = () =>
    setState((s) => (s && s.etcItems.length < MAX_ETC_ITEMS ? { ...s, etcItems: [...s.etcItems, { name: "", amount: 0 }] } : s));
  const removeEtc = (i: number) =>
    setState((s) => {
      if (!s) return s;
      const next = s.etcItems.filter((_, idx) => idx !== i);
      return { ...s, etcItems: next.length ? next : [{ name: "", amount: 0 }] };
    });
  const toggleCheck = (id: number) =>
    setState((s) => (s ? { ...s, checked: { ...s.checked, [id]: !s.checked[id] } } : s));

  const doSave = async () => {
    if (!state || !ctx || busy) return;
    if (!state.moveOutDate) {
      setToast("퇴실일자를 선택해 주세요");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const data = buildSaveData(state, ctx);
      const checklist = ctx.checklist.map((c) => ({
        check_item_id: c.id,
        checked: state.checked[c.id] ?? false,
      }));
      const res = await savePartnerSettlement({
        unitId,
        occupancyId: ctx.occupancy?.id ?? null,
        settlementId: activeId,
        data,
        checklist,
      });
      setActiveId(res.settlementId);
      setToast("이사정산을 저장했어요");
      setTimeout(goBack, 700);
    } catch {
      setErr("저장에 실패했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (activeId === null || busy) return;
    setBusy(true);
    setErr("");
    try {
      await deletePartnerSettlement(activeId);
      setToast("이사정산을 삭제했어요");
      setTimeout(goBack, 700);
    } catch {
      setErr("삭제에 실패했어요. 다시 시도해 주세요.");
      setBusy(false);
    }
  };

  const header = (
    <div className={styles.header}>
      <button type="button" className={styles.back} onClick={() => setConfirmKind("cancel")} aria-label="뒤로">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <div className={styles.titleWrap}>
        <div className={styles.title}>{isEdit ? "이사정산 상세" : "이사정산 등록"}</div>
        {ctx ? (
          <div className={styles.sub}>
            {[ctx.unit.buildingName, [ctx.unit.dong, ctx.unit.unitNo].filter(Boolean).join(" "), ctx.occupancy?.tenantName]
              .filter(Boolean)
              .join(" · ")}
          </div>
        ) : null}
      </div>
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

  if (loadError || !ctx || !state || !totals) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none}>정산 정보를 불러오지 못했어요</div>
        <PartnerBottomActionBar>
          <button type="button" className={`${styles.btn} ${styles.btnSec}`} onClick={goBack}>
            돌아가기
          </button>
        </PartnerBottomActionBar>
      </div>
    );
  }

  const settleAccountText = [ctx.settleAccount.settleBank, ctx.settleAccount.settleAcct, ctx.settleAccount.settleHolder]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.root}>
      {header}

      <div className={styles.scroll}>
        {/* ===== 기본 ===== */}
        <Section title="기본" folded={fold.basic} onToggle={() => setFold((f) => ({ ...f, basic: !f.basic }))}>
          <div className={styles.row}>
            <label className={styles.rowLabel}>퇴실일자</label>
            <input
              type="date"
              className={styles.control}
              value={state.moveOutDate}
              onChange={(e) => patch({ moveOutDate: e.target.value })}
            />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>계산일수 · 기준</label>
            <NumberField value={state.dTotal} onChange={(n) => patch({ dTotal: n })} placeholder="30" />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>계산일수 · 부과</label>
            <NumberField value={state.dDays} onChange={(n) => patch({ dDays: n })} placeholder="0" />
          </div>
        </Section>

        {/* ===== 공과금 정산 ===== */}
        <Section title="공과금 정산" folded={fold.util} onToggle={() => setFold((f) => ({ ...f, util: !f.util }))}>
          {state.util.map((u, i) => (
            <div key={u.k} className={styles.ucard}>
              <div className={styles.ucardTitle}>{UTILITY_LABEL[u.k]}</div>
              <div className={styles.g2}>
                <div className={styles.fld}>
                  <span className={styles.fldLabel}>전월 지침</span>
                  <NumberField value={u.prev} onChange={(n) => patchUtil(i, { prev: n })} />
                </div>
                <div className={styles.fld}>
                  <span className={styles.fldLabel}>이사 지침</span>
                  <NumberField value={u.cur} onChange={(n) => patchUtil(i, { cur: n })} />
                </div>
                <div className={styles.fld}>
                  <span className={styles.fldLabel}>단가</span>
                  <NumberField value={u.price} onChange={(n) => patchUtil(i, { price: n })} />
                </div>
                <div className={styles.fld}>
                  <span className={styles.fldLabel}>입금계좌</span>
                  <input
                    className={styles.control}
                    value={u.acct}
                    onChange={(e) => patchUtil(i, { acct: e.target.value })}
                    placeholder="입금계좌"
                  />
                </div>
                <div className={`${styles.fld} ${styles.fldWide}`}>
                  <span className={styles.fldLabel}>입금일</span>
                  <input
                    type="date"
                    className={styles.control}
                    value={u.payDate}
                    onChange={(e) => patchUtil(i, { payDate: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.calc}>
                <span>
                  사용량 <b>{utilUsage(u).toLocaleString()}</b>
                </span>
                <b>{won(utilAmount(u))}</b>
              </div>
            </div>
          ))}
          <div className={`${styles.calc} ${styles.calcSub}`}>
            <span>① 공과금 소계</span>
            <b>{won(totals.s1)}</b>
          </div>
        </Section>

        {/* ===== 관리비 항목 ===== */}
        <Section
          title="관리비 항목"
          hint="부과액 / 정산액"
          folded={fold.fee}
          onToggle={() => setFold((f) => ({ ...f, fee: !f.fee }))}
        >
          {state.feeItems.map((f, i) => (
            <div key={`${f.name}-${i}`} className={styles.feer}>
              <span className={styles.feerName}>
                {f.name}
                {f.daily ? <em className={styles.tag}>일할</em> : null}
              </span>
              <NumberField
                value={f.charged}
                onChange={(n) => patchFee(i, n)}
                className={`${styles.control} ${styles.num}`}
              />
              <span className={styles.feerVal}>{feeProrated(f, state.dTotal, state.dDays).toLocaleString()}</span>
            </div>
          ))}
          <div className={styles.g2} style={{ marginTop: 12 }}>
            <div className={styles.fld}>
              <span className={styles.fldLabel}>가수금</span>
              <NumberField value={state.adv} onChange={(n) => patch({ adv: n })} />
            </div>
            <div className={styles.fld}>
              <span className={styles.fldLabel}>연락처</span>
              <input
                className={styles.control}
                inputMode="numeric"
                maxLength={13}
                value={state.advTel}
                onChange={(e) => patch({ advTel: formatPhone(e.target.value) })}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <div className={`${styles.calc} ${styles.calcSub}`}>
            <span>② 관리비 소계</span>
            <b>{won(totals.s2)}</b>
          </div>
        </Section>

        {/* ===== 기타 ===== */}
        <Section
          title="기타"
          hint={`${state.etcItems.length} / ${MAX_ETC_ITEMS}`}
          folded={fold.etc}
          onToggle={() => setFold((f) => ({ ...f, etc: !f.etc }))}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
            <button
              type="button"
              className={styles.mini}
              onClick={addEtc}
              disabled={state.etcItems.length >= MAX_ETC_ITEMS}
            >
              항목 추가
            </button>
          </div>
          {state.etcItems.map((x, i) => (
            <div key={i} className={styles.etcr}>
              <input
                className={styles.control}
                value={x.name}
                onChange={(e) => patchEtc(i, { name: e.target.value })}
                placeholder="기타 항목"
              />
              <NumberField
                value={x.amount}
                onChange={(n) => patchEtc(i, { amount: n })}
                className={`${styles.control} ${styles.num} ${styles.etcrAmt}`}
              />
              <button type="button" className={styles.xbtn} onClick={() => removeEtc(i)} aria-label="항목 삭제">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <div className={`${styles.calc} ${styles.calcSub}`}>
            <span>③ 기타 소계</span>
            <b>{won(totals.s3)}</b>
          </div>
        </Section>

        {/* ===== 청소 ===== */}
        <Section title="청소" folded={fold.cleaning} onToggle={() => setFold((f) => ({ ...f, cleaning: !f.cleaning }))}>
          <div className={styles.row}>
            <label className={styles.rowLabel}>청소담당</label>
            <input
              className={styles.control}
              value={state.clnBy}
              onChange={(e) => patch({ clnBy: e.target.value })}
              placeholder="청소담당"
            />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>청소처리</label>
            <select
              className={styles.control}
              value={state.clnStatus}
              onChange={(e) => patch({ clnStatus: e.target.value === "완료" ? "완료" : "미결" })}
            >
              <option value="미결">미결</option>
              <option value="완료">완료</option>
            </select>
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>청소완료일</label>
            <input
              type="date"
              className={styles.control}
              value={state.clnDone}
              onChange={(e) => patch({ clnDone: e.target.value })}
            />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>청소금액</label>
            <NumberField value={state.clnAmt} onChange={(n) => patch({ clnAmt: n })} />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>청소계좌</label>
            <input
              className={styles.control}
              value={state.clnAcct}
              onChange={(e) => patch({ clnAcct: e.target.value })}
              placeholder="은행 계좌번호"
            />
          </div>
          <div className={`${styles.row} ${styles.rowCol}`}>
            <label className={styles.rowLabel}>청소 적요</label>
            <textarea
              className={styles.textarea}
              value={state.clnNote}
              onChange={(e) => patch({ clnNote: e.target.value })}
              placeholder="청소 관련 적요"
            />
          </div>
        </Section>

        {/* ===== 정산 ===== */}
        <Section title="정산" folded={fold.settle} onToggle={() => setFold((f) => ({ ...f, settle: !f.settle }))}>
          <div className={styles.row}>
            <label className={styles.rowLabel}>수납액</label>
            <NumberField value={state.paid} onChange={(n) => patch({ paid: n })} />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>최종 수납일</label>
            <input
              type="date"
              className={styles.control}
              value={state.lastPaidDate}
              onChange={(e) => patch({ lastPaidDate: e.target.value })}
            />
          </div>
          {settleAccountText ? (
            <div className={styles.row}>
              <label className={styles.rowLabel}>정산 입금계좌</label>
              <span className={styles.ro}>{settleAccountText}</span>
            </div>
          ) : null}
          <div className={`${styles.row} ${styles.rowCol}`}>
            <label className={styles.rowLabel}>비고</label>
            <textarea
              className={styles.textarea}
              value={state.memo}
              onChange={(e) => patch({ memo: e.target.value })}
              placeholder="정산 관련 비고를 입력해 주세요"
            />
          </div>
        </Section>

        {/* ===== 정산 체크 ===== */}
        <Section title="정산 체크" folded={fold.check} onToggle={() => setFold((f) => ({ ...f, check: !f.check }))}>
          {ctx.checklist.length === 0 ? (
            <div className={styles.emptyHint}>등록된 점검 항목이 없어요</div>
          ) : (
            ctx.checklist.map((item) => {
              const on = state.checked[item.id] ?? false;
              return (
                <button key={item.id} type="button" className={styles.check} onClick={() => toggleCheck(item.id)}>
                  <span className={`${styles.checkBox} ${on ? styles.checkBoxOn : ""}`}>
                    <CheckMark />
                  </span>
                  <span className={styles.checkLabel}>{item.label}</span>
                </button>
              );
            })
          )}
        </Section>

        {/* ===== 합계 (teal) ===== */}
        <div className={`${styles.sec} ${styles.tot}`}>
          <div className={`${styles.secHead} ${styles.totHead}`}>
            <span>합계</span>
          </div>
          <div className={styles.srow}>
            <span>① 공과금</span>
            <b>{won(totals.s1)}</b>
          </div>
          <div className={styles.srow}>
            <span>② 관리비</span>
            <b>{won(totals.s2)}</b>
          </div>
          <div className={styles.srow}>
            <span>③ 기타</span>
            <b>{won(totals.s3)}</b>
          </div>
          <div className={styles.srow}>
            <span>④ 청소</span>
            <b>{won(totals.cleaning)}</b>
          </div>
          <div className={styles.srow}>
            <span>미납 소계</span>
            <b>{won(totals.unpaidSubtotal)}</b>
          </div>
          <div className={styles.srow}>
            <span>수납액</span>
            <b>{won(state.paid)}</b>
          </div>
          <div className={styles.stot}>
            <span>미수금</span>
            <b className={totals.balance < 0 ? styles.neg : ""}>{won(totals.balance)}</b>
          </div>
        </div>

        {err ? (
          <div className={styles.err} role="alert">
            {err}
          </div>
        ) : null}
      </div>

      <PartnerBottomActionBar>
        {isEdit ? (
          <button type="button" className={`${styles.btn} ${styles.btnDel}`} onClick={() => setConfirmKind("delete")} disabled={busy}>
            삭제
          </button>
        ) : (
          <button type="button" className={`${styles.btn} ${styles.btnSec}`} onClick={() => setConfirmKind("cancel")} disabled={busy}>
            취소
          </button>
        )}
        <button type="button" className={`${styles.btn} ${styles.btnPri}`} onClick={() => setConfirmKind("save")} disabled={busy}>
          저장
        </button>
      </PartnerBottomActionBar>

      {confirmKind ? (
        <div
          className={styles.scrim}
          onClick={(e) => e.target === e.currentTarget && setConfirmKind(null)}
        >
          <div className={styles.dialog}>
            {confirmKind === "save" && (
              <>
                <div className={styles.dTitle}>이사정산을 저장할까요?</div>
                <div className={styles.dDesc}>입력한 값으로 정산 내역이 저장돼요.</div>
                <div className={styles.dActions}>
                  <button type="button" className={`${styles.dBtn} ${styles.dCancel}`} onClick={() => setConfirmKind(null)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className={`${styles.dBtn} ${styles.dOk}`}
                    onClick={() => {
                      setConfirmKind(null);
                      void doSave();
                    }}
                  >
                    저장
                  </button>
                </div>
              </>
            )}
            {confirmKind === "cancel" && (
              <>
                <div className={styles.dTitle}>작성을 취소할까요?</div>
                <div className={styles.dDesc}>입력한 내용은 저장되지 않아요.</div>
                <div className={styles.dActions}>
                  <button type="button" className={`${styles.dBtn} ${styles.dCancel}`} onClick={() => setConfirmKind(null)}>
                    계속 작성
                  </button>
                  <button type="button" className={`${styles.dBtn} ${styles.dDanger}`} onClick={goBack}>
                    나가기
                  </button>
                </div>
              </>
            )}
            {confirmKind === "delete" && (
              <>
                <div className={styles.dTitle}>이사정산을 삭제할까요?</div>
                <div className={styles.dDesc}>삭제하면 이 정산 내역은 복구할 수 없어요.</div>
                <div className={styles.dActions}>
                  <button type="button" className={`${styles.dBtn} ${styles.dCancel}`} onClick={() => setConfirmKind(null)}>
                    취소
                  </button>
                  <button
                    type="button"
                    className={`${styles.dBtn} ${styles.dDanger}`}
                    onClick={() => {
                      setConfirmKind(null);
                      void doDelete();
                    }}
                  >
                    삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </div>
  );
}

export default function PartnerMsNewPage() {
  return (
    <Suspense fallback={<div className={styles.root} />}>
      <MsNewInner />
    </Suspense>
  );
}
