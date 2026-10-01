"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

import { applyMask, Input, phoneMask, PHONE_INPUT_ATTRS, Textarea } from "@/components/common";
import {
  useDeletePartnerSettlement,
  useSavePartnerSettlement,
} from "@/hooks/reactquery/movingSettlement";
import { PartnerBottomActionBar } from "../../../_components/PartnerBottomActionBar";
import { PartnerDateSheet } from "../../../_components/PartnerDateSheet";
import { PartnerDropdown } from "../../../_components/PartnerDropdown";
import { PartnerInlineError } from "../../../_components/PartnerInlineError";
import { PartnerToast, usePartnerToast } from "../../../_components/PartnerToast";
import {
  buildSaveData,
  computeTotals,
  feeProrated,
  initialState,
  mapContext,
  MAX_ETC_ITEMS,
  type ContextJson,
  type MSState,
  type PartnerSettlementContext,
  toNumber,
  utilAmount,
  UTILITY_LABEL,
  utilUsage,
  won,
} from "./_ms";
import { msClasses as styles } from "./msClasses";
import { PartnerButton } from "../../../_components/PartnerButton";
import { PartnerConfirmDialog } from "../../../_components/PartnerConfirmDialog";

type SectionKey = "basic" | "util" | "fee" | "etc" | "cleaning" | "settle" | "check";

const CLEANING_STATUS_OPTIONS = [
  { value: "미결", label: "미결" },
  { value: "완료", label: "완료" },
];

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
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Section({
  title,
  hint,
  action,
  folded,
  onToggle,
  children,
}: {
  title: string;
  hint?: string;
  /** 머리 오른쪽 버튼(기타 [항목 추가]). 눌러도 섹션은 접히지 않는다. */
  action?: ReactNode;
  folded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  // 정본 `.sec-t`: 머리 어디를 눌러도 접고 펼친다. 제목 버튼의 클릭도 여기로 올라와 한 번만 바뀐다(키보드 포함).
  return (
    <div className={styles.sec}>
      <div className={styles.secHead} onClick={onToggle}>
        <button type="button" className={styles.secToggle} aria-expanded={!folded}>
          <span>{title}</span>
          {hint ? <span className={styles.secHint}>{hint}</span> : null}
        </button>
        {action}
        <ChevronDown folded={folded} />
      </div>
      {folded ? null : children}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  className,
  placeholder = "0",
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  className: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <Input
      unstyled
      className={className}
      inputMode="numeric"
      value={value ? value.toLocaleString() : ""}
      onChange={(e) => onChange(toNumber(e.target.value))}
      placeholder={placeholder}
      aria-label={ariaLabel}
    />
  );
}

type PartnerMsNewWorkspaceProps = {
  unitId: number;
  editId: number | null;
  contextData: ContextJson | null;
  loadError: boolean;
};

export default function PartnerMsNewWorkspace({
  unitId,
  editId,
  contextData,
  loadError,
}: PartnerMsNewWorkspaceProps) {
  const router = useRouter();
  let ctx: PartnerSettlementContext | null = null;
  try {
    ctx = contextData ? mapContext(contextData) : null;
  } catch {
    // 기존 client fetch와 동일하게 예상하지 못한 context 형태도 load error로 처리한다.
  }
  const [state, setState] = useState<MSState | null>(() => {
    if (!ctx) return null;
    // 새 등록은 빈 양식이다. 조회 RPC는 정산 id 없이 부르면 진행 중인 직전 정산과 그 체크 메모를 함께 주므로 둘 다 비운다.
    const forInit =
      editId === null
        ? {
            ...ctx,
            latestSettlement: null,
            checklist: ctx.checklist.map((item) => ({ ...item, checked: false, note: null })),
          }
        : ctx;
    return initialState(forInit);
  });
  const [activeId, setActiveId] = useState<number | null>(editId);
  const [err, setErr] = useState("");
  const { toastMessage, showToast } = usePartnerToast();
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

  const totals = useMemo(() => (state ? computeTotals(state) : null), [state]);
  const saveMutation = useSavePartnerSettlement();
  const deleteMutation = useDeletePartnerSettlement();
  const isSettlementMutating = saveMutation.isPending || deleteMutation.isPending;

  const backHref = Number.isFinite(unitId) ? `/partner/mobile-tenant?id=${unitId}` : "/partner/mobile-inquiry";
  const goBack = () => router.push(backHref);
  const isEdit = activeId !== null;

  const toggleFold = (key: SectionKey) => setFold((f) => ({ ...f, [key]: !f[key] }));

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
  const patchNote = (id: number, note: string) =>
    setState((s) => (s ? { ...s, notes: { ...s.notes, [id]: note } } : s));

  const doSave = async () => {
    if (!state || !ctx || isSettlementMutating) return;
    if (!state.moveOutDate) {
      showToast("퇴실일자를 선택해 주세요");
      return;
    }
    setErr("");
    try {
      const data = buildSaveData(state, ctx);
      // 사무실 화면과 같은 규칙: 메모가 있으면 체크된 것으로 저장한다(0172).
      const checklist = ctx.checklist.map((c) => {
        const note = (state.notes[c.id] ?? "").trim();
        return { check_item_id: c.id, checked: note !== "", note };
      });
      const res = await saveMutation.mutateAsync({
        unitId,
        occupancyId: ctx.occupancy?.id ?? null,
        settlementId: activeId,
        data,
        checklist,
      });
      setActiveId(res.settlementId);
      showToast("이사정산을 저장했어요");
      setTimeout(goBack, 700);
    } catch {
      setErr("저장에 실패했어요. 다시 시도해 주세요.");
    }
  };

  const doDelete = async () => {
    if (activeId === null || isSettlementMutating) return;
    setErr("");
    try {
      await deleteMutation.mutateAsync(activeId);
      showToast("이사정산을 삭제했어요");
      setTimeout(goBack, 700);
    } catch {
      setErr("삭제에 실패했어요. 다시 시도해 주세요.");
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

  if (loadError || !ctx || !state || !totals) {
    return (
      <div className={styles.root}>
        {header}
        <div className={styles.none}>정산 정보를 불러오지 못했어요</div>
        <PartnerBottomActionBar>
          <PartnerButton variant="secondary" type="button" className="flex-1" onClick={goBack}>
            돌아가기
          </PartnerButton>
        </PartnerBottomActionBar>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {header}

      <div className={styles.scroll}>
        {/* ===== 기본 ===== */}
        <Section title="기본" folded={fold.basic} onToggle={() => toggleFold("basic")}>
          <div className={styles.row}>
            <label className={styles.rowLabel}>퇴실일자</label>
            <PartnerDateSheet
              look="settlement"
              value={state.moveOutDate}
              onChange={(value) => patch({ moveOutDate: value })}
              ariaLabel="퇴실일자"
            />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>계산일수 · 기준</label>
            <NumberField className={styles.rowNum} value={state.dTotal} onChange={(n) => patch({ dTotal: n })} placeholder="30" />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>계산일수 · 부과</label>
            <NumberField className={styles.rowNum} value={state.dDays} onChange={(n) => patch({ dDays: n })} />
          </div>
        </Section>

        {/* ===== 공과금 정산 ===== */}
        <Section title="공과금 정산" folded={fold.util} onToggle={() => toggleFold("util")}>
          {state.util.map((u, i) => (
            <div key={u.k} className={styles.ucard}>
              <div className={styles.ucardTitle}>{UTILITY_LABEL[u.k]}</div>
              <div className={styles.ucardFields}>
                <div className={styles.fld}>
                  <span className={styles.fldLabel}>전월 지침</span>
                  <NumberField className={styles.fldNum} value={u.prev} onChange={(n) => patchUtil(i, { prev: n })} />
                </div>
                <div className={styles.fld}>
                  <span className={styles.fldLabel}>이사 지침</span>
                  <NumberField className={styles.fldNum} value={u.cur} onChange={(n) => patchUtil(i, { cur: n })} />
                </div>
                <div className={styles.fld}>
                  <span className={styles.fldLabel}>단가</span>
                  <NumberField className={styles.fldNum} value={u.price} onChange={(n) => patchUtil(i, { price: n })} />
                </div>
                <div className={styles.fld}>
                  <span className={styles.fldLabel}>입금계좌</span>
                  <Input
                    unstyled
                    className={styles.fldInput}
                    value={u.acct}
                    onChange={(e) => patchUtil(i, { acct: e.target.value })}
                    placeholder="입금계좌"
                  />
                </div>
              </div>
              <div className={styles.fldPayDate}>
                <span className={styles.fldLabel}>입금일</span>
                <PartnerDateSheet
                  look="settlement"
                  value={u.payDate}
                  onChange={(value) => patchUtil(i, { payDate: value })}
                  ariaLabel={`${UTILITY_LABEL[u.k]} 입금일`}
                />
              </div>
              <div className={styles.calc}>
                <span>
                  사용량 <b className={styles.calcValue}>{utilUsage(u).toLocaleString()}</b>
                </span>
                <b className={styles.calcAmount}>{won(utilAmount(u))}</b>
              </div>
            </div>
          ))}
          <div className={styles.calcSub}>
            <span>① 공과금 소계</span>
            <b className={styles.calcSubValue}>{won(totals.s1)}</b>
          </div>
        </Section>

        {/* ===== 관리비 항목 ===== */}
        <Section title="관리비 항목" hint="부과액 / 정산액" folded={fold.fee} onToggle={() => toggleFold("fee")}>
          {/* 정본 #mnFee: 마지막 항목 아래 줄이 없도록 항목만 묶는다(last:border-b-0) */}
          <div>
            {state.feeItems.map((f, i) => (
              <div key={`${f.name}-${i}`} className={styles.feer}>
                <span className={styles.feerName}>
                  {f.name}
                  {f.daily ? <em className={styles.tag}>일할</em> : null}
                </span>
                <NumberField
                  className={styles.feerInput}
                  value={f.charged}
                  onChange={(n) => patchFee(i, n)}
                  ariaLabel={`${f.name} 부과액`}
                />
                <span className={styles.feerVal}>{feeProrated(f, state.dTotal, state.dDays).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className={styles.feeExtra}>
            <div className={styles.fld}>
              <span className={styles.fldLabel}>가수금</span>
              <NumberField className={styles.fldNum} value={state.adv} onChange={(n) => patch({ adv: n })} />
            </div>
            <div className={styles.fld}>
              <span className={styles.fldLabel}>연락처</span>
              <Input
                unstyled
                {...PHONE_INPUT_ATTRS}
                className={styles.fldInput}
                maxLength={13}
                value={state.advTel}
                onChange={(e) => patch({ advTel: applyMask(e.currentTarget, phoneMask) })}
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <div className={styles.calcSub}>
            <span>② 관리비 소계</span>
            <b className={styles.calcSubValue}>{won(totals.s2)}</b>
          </div>
        </Section>

        {/* ===== 기타 ===== */}
        <Section
          title="기타"
          hint={`${state.etcItems.length} / ${MAX_ETC_ITEMS}`}
          action={
            <button
              type="button"
              className={styles.mini}
              onClick={(e) => {
                e.stopPropagation();
                addEtc();
              }}
              disabled={state.etcItems.length >= MAX_ETC_ITEMS}
            >
              항목 추가
            </button>
          }
          folded={fold.etc}
          onToggle={() => toggleFold("etc")}
        >
          {state.etcItems.map((x, i) => (
            <div key={i} className={styles.etcr}>
              <Input
                unstyled
                className={styles.etcName}
                value={x.name}
                onChange={(e) => patchEtc(i, { name: e.target.value })}
                placeholder="기타 항목"
              />
              <NumberField className={styles.etcAmount} value={x.amount} onChange={(n) => patchEtc(i, { amount: n })} />
              <button
                type="button"
                className={state.etcItems.length < 2 ? styles.xbtnHidden : styles.xbtn}
                onClick={() => removeEtc(i)}
                aria-label="항목 삭제"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <div className={styles.calcSub}>
            <span>③ 기타 소계</span>
            <b className={styles.calcSubValue}>{won(totals.s3)}</b>
          </div>
        </Section>

        {/* ===== 청소 ===== */}
        <Section title="청소" folded={fold.cleaning} onToggle={() => toggleFold("cleaning")}>
          <div className={styles.row}>
            <label className={styles.rowLabel}>청소담당</label>
            <Input
              unstyled
              className={styles.rowInput}
              value={state.clnBy}
              onChange={(e) => patch({ clnBy: e.target.value })}
              placeholder="청소담당"
            />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>청소처리</label>
            <PartnerDropdown
              look="settlement"
              ariaLabel="청소처리"
              value={state.clnStatus}
              options={CLEANING_STATUS_OPTIONS}
              onChange={(value) => patch({ clnStatus: value === "완료" ? "완료" : "미결" })}
            />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>청소완료일</label>
            <PartnerDateSheet
              look="settlement"
              value={state.clnDone}
              onChange={(value) => patch({ clnDone: value })}
              ariaLabel="청소완료일"
            />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>청소금액</label>
            <NumberField className={styles.rowNum} value={state.clnAmt} onChange={(n) => patch({ clnAmt: n })} />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>청소계좌</label>
            <Input
              unstyled
              className={styles.rowInput}
              value={state.clnAcct}
              onChange={(e) => patch({ clnAcct: e.target.value })}
              placeholder="은행 계좌번호"
            />
          </div>
          <div className={styles.rowCol}>
            <label className={styles.rowColLabel}>청소 적요</label>
            <Textarea
              unstyled
              className={styles.textarea}
              value={state.clnNote}
              onChange={(e) => patch({ clnNote: e.target.value })}
              placeholder="청소 관련 적요"
            />
          </div>
        </Section>

        {/* ===== 정산 ===== */}
        <Section title="정산" folded={fold.settle} onToggle={() => toggleFold("settle")}>
          <div className={styles.row}>
            <label className={styles.rowLabel}>수납액</label>
            <NumberField className={styles.rowNum} value={state.paid} onChange={(n) => patch({ paid: n })} />
          </div>
          <div className={styles.row}>
            <label className={styles.rowLabel}>최종 수납일</label>
            <PartnerDateSheet
              look="settlement"
              value={state.lastPaidDate}
              onChange={(value) => patch({ lastPaidDate: value })}
              ariaLabel="최종 수납일"
            />
          </div>
          <div className={styles.rowCol}>
            <label className={styles.rowColLabel}>비고</label>
            <Textarea
              unstyled
              className={styles.textarea}
              value={state.memo}
              onChange={(e) => patch({ memo: e.target.value })}
              placeholder="정산 관련 비고를 입력해 주세요"
            />
          </div>
        </Section>

        {/* ===== 정산 체크 — 항목별 메모(정본 `.c-in`) ===== */}
        <Section title="정산 체크" folded={fold.check} onToggle={() => toggleFold("check")}>
          {ctx.checklist.length === 0 ? (
            <div className={styles.emptyHint}>등록된 점검 항목이 없어요</div>
          ) : (
            ctx.checklist.map((item) => (
              <div key={item.id} className={styles.row}>
                <label className={styles.checkLabel} htmlFor={`ms-check-${item.id}`}>
                  {item.label}
                </label>
                <Input
                  unstyled
                  id={`ms-check-${item.id}`}
                  className={styles.rowInput}
                  value={state.notes[item.id] ?? ""}
                  onChange={(e) => patchNote(item.id, e.target.value)}
                  maxLength={100}
                  placeholder="입력"
                />
              </div>
            ))
          )}
        </Section>

        {/* ===== 합계 (teal) ===== */}
        <div className={styles.tot}>
          <div className={styles.totHead}>합계</div>
          <div className={styles.srow}>
            <span>① 공과금</span>
            <b className={styles.srowValue}>{won(totals.s1)}</b>
          </div>
          <div className={styles.srow}>
            <span>② 관리비</span>
            <b className={styles.srowValue}>{won(totals.s2)}</b>
          </div>
          <div className={styles.srow}>
            <span>③ 기타</span>
            <b className={styles.srowValue}>{won(totals.s3)}</b>
          </div>
          <div className={styles.srow}>
            <span>④ 청소</span>
            <b className={styles.srowValue}>{won(totals.cleaning)}</b>
          </div>
          <div className={styles.srow}>
            <span>미납 소계</span>
            <b className={styles.srowValue}>{won(totals.unpaidSubtotal)}</b>
          </div>
          <div className={styles.srow}>
            <span>수납액</span>
            <b className={styles.srowValue}>{won(state.paid)}</b>
          </div>
          <div className={styles.stot}>
            <span>미수금</span>
            <b className={totals.balance < 0 ? styles.stotValueNeg : styles.stotValue}>{won(totals.balance)}</b>
          </div>
        </div>

        {err ? <PartnerInlineError message={err} /> : null}
      </div>

      <PartnerBottomActionBar>
        {isEdit ? (
          <PartnerButton variant="danger" type="button" className="flex-1" onClick={() => setConfirmKind("delete")} disabled={isSettlementMutating}>
            {deleteMutation.isPending ? "삭제 중…" : "삭제"}
          </PartnerButton>
        ) : (
          <PartnerButton variant="secondary" type="button" className="flex-1" onClick={() => setConfirmKind("cancel")} disabled={isSettlementMutating}>
            취소
          </PartnerButton>
        )}
        <PartnerButton variant="primary" type="button" className="flex-1" onClick={() => setConfirmKind("save")} disabled={isSettlementMutating}>
          저장
        </PartnerButton>
      </PartnerBottomActionBar>

      {confirmKind === "save" ? (
        <PartnerConfirmDialog
          title="이사정산을 저장할까요?"
          description="입력한 값으로 정산 내역이 저장돼요."
          cancelLabel="취소"
          confirmLabel="저장"
          onCancel={() => setConfirmKind(null)}
          onConfirm={() => {
            setConfirmKind(null);
            void doSave();
          }}
        />
      ) : null}
      {confirmKind === "cancel" ? (
        <PartnerConfirmDialog
          title="작성을 취소할까요?"
          description="입력한 내용은 저장되지 않아요."
          cancelLabel="계속 작성"
          confirmLabel="나가기"
          confirmVariant="danger"
          onCancel={() => setConfirmKind(null)}
          onConfirm={goBack}
        />
      ) : null}
      {confirmKind === "delete" ? (
        <PartnerConfirmDialog
          title="이사정산을 삭제할까요?"
          description="삭제하면 이 정산 내역은 복구할 수 없어요."
          cancelLabel="취소"
          confirmLabel="삭제"
          confirmVariant="danger"
          onCancel={() => setConfirmKind(null)}
          onConfirm={() => {
            setConfirmKind(null);
            void doDelete();
          }}
        />
      ) : null}

      <PartnerToast message={toastMessage} />
    </div>
  );
}
