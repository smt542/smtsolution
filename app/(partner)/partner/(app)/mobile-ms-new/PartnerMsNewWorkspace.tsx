"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { type ReactNode, useRef, useState } from "react";

import { applyMask, Input, phoneMask, PHONE_INPUT_ATTRS, Textarea } from "@/components/common";
import {
  useDeletePartnerSettlement,
  usePartnerSettlementFeeItems,
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
  chargeDaysFromMoveOut,
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
const EDITABLE_SETTLEMENT_STATUSES = ["draft", "saved"];
const LOCKED_SETTLEMENT_MESSAGE = "정산이 완료되어 수정할 수 없어요. 내역서 확인·이미지 저장만 가능해요.";

type ConfirmKind = "save" | "cancel" | "delete" | "statementNegative" | "saveNegative";

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
  locked = false,
  children,
}: {
  title: string;
  hint?: string;
  /** 머리 오른쪽 버튼(기타 [항목 추가]). 눌러도 섹션은 접히지 않는다. */
  action?: ReactNode;
  folded: boolean;
  onToggle: () => void;
  /** 완료된 정산: 접기·펼치기만 되고 안의 입력·버튼은 모두 막는다(레이아웃 영향 없는 fieldset). */
  locked?: boolean;
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
        {action ? <fieldset disabled={locked} className="contents">{action}</fieldset> : null}
        <ChevronDown folded={folded} />
      </div>
      {folded ? null : <fieldset disabled={locked} className="contents">{children}</fieldset>}
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

// 단가는 소수점(예: 125.5)을 받는다. 입력 중 "125."처럼 숫자로 못 되돌리는 문자열은 draft로 들고 있다.
function DecimalField({
  value,
  onChange,
  className,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  className: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      unstyled
      className={className}
      inputMode="decimal"
      value={draft ?? (value ? value.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "")}
      onChange={(e) => {
        const [int = "", ...frac] = e.target.value.replace(/[^0-9.]/g, "").split(".");
        const text = frac.length ? `${int}.${frac.join("")}` : int;
        setDraft(text);
        onChange(Number(text) || 0);
      }}
      onBlur={() => setDraft(null)}
      placeholder="0"
      aria-label={ariaLabel}
    />
  );
}

function statementDate(value: string): string {
  return value ? value.replaceAll("-", ".") : "—";
}

function todayStatementDate(): string {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
}

function compactStatementDate(value: string): string {
  return value.replace(/[^0-9]/g, "") || todayStatementDate().replace(/[^0-9]/g, "");
}

function safeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "호실";
}

function settlementAccountLabel(ctx: PartnerSettlementContext): string {
  const account = [ctx.settleAccount.settleBank, ctx.settleAccount.settleAcct]
    .map((value) => value?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return [account, ctx.settleAccount.settleHolder?.trim() ?? ""].filter(Boolean).join(" · ") || "등록된 정산 계좌가 없습니다.";
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
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [statementOpen, setStatementOpen] = useState(false);
  const [statementSavePending, setStatementSavePending] = useState(false);
  const statementSheetRef = useRef<HTMLDivElement>(null);
  const [fold, setFold] = useState<Record<SectionKey, boolean>>({
    basic: false,
    util: true,
    fee: true,
    etc: true,
    cleaning: true,
    settle: true,
    check: true,
  });

  // 저장·합계에 쓰는 컨텍스트. 새 등록이면 조회 RPC가 함께 준 직전 정산(공과금 저장 금액 등)을 쓰지 않는다.
  const saveCtx: PartnerSettlementContext | null =
    ctx && editId === null ? { ...ctx, latestSettlement: null } : ctx;
  // 미수금 = 서버 settlement_amount(①+②+③미납+④) − 수납액. 저장 RPC와 같은 식(개선3차 31).
  const totals = state && saveCtx ? computeTotals(state, saveCtx) : null;
  const saveMutation = useSavePartnerSettlement();
  const deleteMutation = useDeletePartnerSettlement();
  const isSettlementMutating = saveMutation.isPending || deleteMutation.isPending;

  const backHref = Number.isFinite(unitId) ? `/partner/mobile-tenant?id=${unitId}` : "/partner/mobile-inquiry";
  const goBack = () => router.push(backHref);
  const isEdit = activeId !== null;
  // 정산완료(중도퇴실·퇴실) 등 작성중·저장이 아닌 정산은 서버가 수정·삭제를 받지 않는다 — 읽기 전용으로 연다.
  const isLocked =
    editId !== null &&
    ctx?.latestSettlement?.id === editId &&
    !EDITABLE_SETTLEMENT_STATUSES.includes(ctx.latestSettlement.status);

  // 관리비 항목 = 건물 유형의 실제 관리비 항목 + 그 세대의 퇴실월 부과액(사무실 이사정산과 같은 원천).
  // 사람이 손대지 않은 항목(전부 0이거나 직전에 자동으로 채운 그대로)일 때만 채우고, 직접 입력한 값은 덮어쓰지 않는다.
  const feePeriod = state?.moveOutDate ? `${state.moveOutDate.slice(0, 7)}-01` : null;
  const feeItemsQuery = usePartnerSettlementFeeItems(isLocked ? null : unitId, feePeriod);
  const [feeSeed, setFeeSeed] = useState<{ period: string; json: string } | null>(null);
  const fetchedFeeItems = feeItemsQuery.data;
  if (state && feePeriod && fetchedFeeItems && feeSeed?.period !== feePeriod) {
    const currentJson = JSON.stringify(state.feeItems);
    const untouched =
      state.feeItems.every((fee) => !fee.charged) || (feeSeed !== null && feeSeed.json === currentJson);
    const nextItems = fetchedFeeItems.map((fee) => ({ ...fee }));
    const fill = untouched && fetchedFeeItems.length > 0;
    setFeeSeed({ period: feePeriod, json: fill ? JSON.stringify(nextItems) : currentJson });
    if (fill) setState((current) => (current ? { ...current, feeItems: nextItems } : current));
  }

  const openStatement = () => {
    if (!isEdit || !state || !totals) return;
    if (totals.balance < 0) {
      setConfirmKind("statementNegative");
      return;
    }
    setStatementOpen(true);
  };

  const saveStatementImage = async () => {
    if (statementSavePending || !state || !ctx || !statementSheetRef.current) return;

    showToast("이미지를 만들고 있어요");
    setStatementSavePending(true);

    let toPng: typeof import("html-to-image").toPng;
    let getFontEmbedCSS: typeof import("html-to-image").getFontEmbedCSS;
    try {
      ({ toPng, getFontEmbedCSS } = await import("html-to-image"));
    } catch {
      showToast("이미지 변환을 불러오지 못했어요");
      setStatementSavePending(false);
      return;
    }

    let captureBox: HTMLDivElement | null = null;
    try {
      captureBox = document.createElement("div");
      captureBox.style.cssText =
        "position:fixed;left:-10000px;top:0;width:480px;background:#fff;z-index:-1;pointer-events:none";
      const clone = statementSheetRef.current.cloneNode(true) as HTMLDivElement;
      clone.style.width = "480px";
      clone.style.maxHeight = "none";
      clone.style.overflow = "visible";
      captureBox.appendChild(clone);
      document.body.appendChild(captureBox);

      const images = [...clone.querySelectorAll<HTMLImageElement>("img")];
      await Promise.all(
        images.map(
          (image) =>
            image.complete
              ? Promise.resolve()
              : new Promise<void>((resolve) => {
                  image.addEventListener("load", () => resolve(), { once: true });
                  image.addEventListener("error", () => resolve(), { once: true });
                }),
        ),
      );

      let fontCSS = "";
      try {
        fontCSS = await getFontEmbedCSS(clone);
      } catch {
        // 폰트 임베드가 막혀도 시스템 폰트로 이미지 저장은 계속한다.
      }
      const dataUrl = await toPng(clone, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        fontEmbedCSS: fontCSS || undefined,
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `이사정산내역서_${safeFilePart(ctx.unit.unitNo)}_${compactStatementDate(state.moveOutDate)}.png`;
      link.click();
      showToast("이미지를 저장했어요");
    } catch {
      showToast("이미지 저장에 실패했어요");
    } finally {
      captureBox?.remove();
      setStatementSavePending(false);
    }
  };

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
    if (!state || !ctx || !saveCtx || !totals || isSettlementMutating) return;
    if (!state.moveOutDate) {
      showToast("퇴실일자를 선택해 주세요");
      return;
    }
    // 정책: 미수금 < 0이면 저장 차단(확인만, 저장 안 됨).
    if (totals.balance < 0) {
      setConfirmKind("saveNegative");
      return;
    }
    setErr("");
    try {
      const data = buildSaveData(state, saveCtx);
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
    } catch (e) {
      // 서버 가드(미수금 < 0 · 음수 금액)는 안내 문구를 그대로 보여준다.
      const message = e instanceof Error ? e.message : "";
      setErr(
        message.startsWith("입력값을 다시 확인해 주세요")
          ? message
          : message.includes("editable settlement not in unit")
            ? LOCKED_SETTLEMENT_MESSAGE
            : "저장에 실패했어요. 다시 시도해 주세요.",
      );
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
      <button type="button" className={styles.back} onClick={() => (isLocked ? goBack() : setConfirmKind("cancel"))} aria-label="뒤로">
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
      {isEdit ? (
        <button type="button" className={styles.doc} onClick={openStatement} aria-label="내역서 열기">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 3h9l4 4v14H6z" />
            <path d="M9 12h7M9 16h7" />
          </svg>
          내역서
        </button>
      ) : null}
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

  const statementUnit = [ctx.unit.dong, ctx.unit.unitNo].filter(Boolean).join(" ");
  const statementLocation = [[ctx.unit.buildingName, statementUnit].filter(Boolean).join(" "), ctx.occupancy?.tenantName]
    .filter(Boolean)
    .join(" · ");
  const accountLabel = settlementAccountLabel(ctx);
  const statementToday = todayStatementDate();
  const feeHasRows = state.feeItems.some((fee) => feeProrated(fee, state.dTotal, state.dDays) !== 0) || state.adv !== 0;
  const hasEtcRows = state.etcItems.some((item) => item.name.trim() !== "" || item.amount !== 0);

  return (
    <div className={styles.root}>
      {header}

      <div className={styles.scroll}>
        {/* ===== 기본 ===== */}
        <Section locked={isLocked} title="기본" folded={fold.basic} onToggle={() => toggleFold("basic")}>
          <div className={styles.row}>
            <label className={styles.rowLabel}>퇴실일자</label>
            <PartnerDateSheet
              look="settlement"
              value={state.moveOutDate}
              // 퇴실일을 고르면 계산일수 · 부과를 그 날짜의 실거주 일수로 다시 채운다(이후 직접 수정 가능).
              onChange={(value) => patch({ moveOutDate: value, dDays: chargeDaysFromMoveOut(value) })}
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
        <Section locked={isLocked} title="공과금 정산" folded={fold.util} onToggle={() => toggleFold("util")}>
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
                  <DecimalField className={styles.fldNum} value={u.price} onChange={(n) => patchUtil(i, { price: n })} />
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
        <Section locked={isLocked} title="관리비 항목" hint="부과액 / 정산액" folded={fold.fee} onToggle={() => toggleFold("fee")}>
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
        <Section locked={isLocked}
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
        <Section locked={isLocked} title="청소" folded={fold.cleaning} onToggle={() => toggleFold("cleaning")}>
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
        <Section locked={isLocked} title="정산" folded={fold.settle} onToggle={() => toggleFold("settle")}>
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
        <Section locked={isLocked} title="정산 체크" folded={fold.check} onToggle={() => toggleFold("check")}>
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
          {totals.billingUnpaid !== 0 ? (
            <div className={styles.srow}>
              <span>미납 관리비</span>
              <b className={styles.srowValue}>{won(totals.billingUnpaid)}</b>
            </div>
          ) : null}
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

        {isLocked ? <PartnerInlineError message={LOCKED_SETTLEMENT_MESSAGE} /> : err ? <PartnerInlineError message={err} /> : null}
      </div>

      {isLocked ? (
        <PartnerBottomActionBar>
          <PartnerButton variant="secondary" type="button" className="flex-1" onClick={goBack}>
            목록으로
          </PartnerButton>
        </PartnerBottomActionBar>
      ) : (
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
        <PartnerButton variant="primary" type="button" className="flex-1" onClick={() => {
          // 퇴실일자가 없으면 저장 확인창을 띄우지 않고 바로 안내한다.
          if (!state?.moveOutDate) {
            showToast("퇴실일자를 선택해 주세요");
            return;
          }
          // 미수금 < 0이면 저장 확인 대신 확인 전용 안내만 띄운다(저장 차단).
          if (totals.balance < 0) {
            setConfirmKind("saveNegative");
            return;
          }
          setConfirmKind("save");
        }} disabled={isSettlementMutating}>
          저장
        </PartnerButton>
      </PartnerBottomActionBar>
      )}

      {statementOpen ? (
        <div className={styles.statementScrim} role="dialog" aria-modal="true" aria-label="이사정산 내역서">
          <div className={styles.statementStage}>
            <div className={styles.statementCard}>
              <div className={styles.statementBody}>
                <div ref={statementSheetRef} className={styles.statementSheet}>
                  <div className={styles.statementBrand}>
                    <span className={styles.statementMark}>
                      <Image src="/logo-mark.png" alt="관리비서" width={24} height={24} unoptimized className={styles.statementMarkImage} />
                    </span>
                    <span className={styles.statementWordmark}>
                      관리<em className={styles.statementWordmarkAccent}>비서</em>
                    </span>
                  </div>

                  <div className={styles.statementHeader}>
                    <div className="min-w-0">
                      <h1 className={styles.statementTitle}>이사정산 내역서</h1>
                      <div className={styles.statementLocation}>{statementLocation}</div>
                    </div>
                    <div className={styles.statementDate}>
                      퇴실일자
                      <br />
                      <b className={styles.statementDateValue}>{statementDate(state.moveOutDate)}</b>
                      <br />
                      발행 {statementToday}
                    </div>
                  </div>

                  <div className={styles.statementGroup}>공과금</div>
                  {state.util.map((utility) => (
                    <div key={utility.k} className={styles.statementRow}>
                      <span className={styles.statementRowLabel}>
                        {UTILITY_LABEL[utility.k]}{" "}
                        <span className={styles.statementRowMeta}>
                          {utilUsage(utility).toLocaleString()} × {utility.price.toLocaleString()}
                        </span>
                      </span>
                      <b className={styles.statementRowValue}>{won(utilAmount(utility))}</b>
                    </div>
                  ))}

                  <div className={styles.statementGroup}>관리비</div>
                  {feeHasRows ? (
                    <>
                      {state.feeItems.map((fee, index) => {
                        const amount = feeProrated(fee, state.dTotal, state.dDays);
                        return amount !== 0 ? (
                          <div key={`fee-${index}`} className={styles.statementRow}>
                            <span className={styles.statementRowLabel}>{fee.name}</span>
                            <b className={styles.statementRowValue}>{won(amount)}</b>
                          </div>
                        ) : null;
                      })}
                      {state.adv !== 0 ? (
                        <div className={styles.statementRow}>
                          <span className={styles.statementRowLabel}>가수금</span>
                          <b className={styles.statementRowValue}>{won(state.adv)}</b>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className={styles.statementRow}>
                      <span className={styles.statementRowLabel}>내역 없음</span>
                      <b className={styles.statementRowValue}>0원</b>
                    </div>
                  )}

                  {hasEtcRows ? (
                    <>
                      <div className={styles.statementGroup}>기타</div>
                      {state.etcItems.map((item, index) =>
                        item.name.trim() !== "" || item.amount !== 0 ? (
                          <div key={`etc-${index}`} className={styles.statementRow}>
                            <span className={styles.statementRowLabel}>{item.name.trim() || "기타"}</span>
                            <b className={styles.statementRowValue}>{won(item.amount)}</b>
                          </div>
                        ) : null,
                      )}
                    </>
                  ) : null}

                  {state.clnAmt !== 0 ? (
                    <>
                      <div className={styles.statementGroup}>청소</div>
                      <div className={styles.statementRow}>
                        <span className={styles.statementRowLabel}>
                          {state.clnBy.trim() || "청소비"}{" "}
                          <span className={styles.statementRowMeta}>{state.clnStatus}</span>
                        </span>
                        <b className={styles.statementRowValue}>{won(state.clnAmt)}</b>
                      </div>
                    </>
                  ) : null}

                  <div className={styles.statementGroup}>정산</div>
                  {totals.billingUnpaid !== 0 ? (
                    <div className={styles.statementRow}>
                      <span className={styles.statementRowLabel}>미납 관리비</span>
                      <b className={styles.statementRowValue}>{won(totals.billingUnpaid)}</b>
                    </div>
                  ) : null}
                  <div className={styles.statementRow}>
                    <span className={styles.statementRowLabel}>미납 소계</span>
                    <b className={styles.statementRowValue}>{won(totals.unpaidSubtotal)}</b>
                  </div>
                  <div className={styles.statementRow}>
                    <span className={styles.statementRowLabel}>수납액</span>
                    <b className={styles.statementRowValue}>{won(state.paid)}</b>
                  </div>
                  <div
                    className={`${styles.statementSum} ${totals.balance < 0 ? styles.statementSumNegative : ""}`}
                    style={totals.balance < 0 ? { backgroundColor: "#FDECEE", color: "#F04452" } : undefined}
                  >
                    <span>미수금</span>
                    <b className={styles.statementSumValue}>{won(totals.balance)}</b>
                  </div>

                  {state.memo.trim() ? <div className={styles.statementNote}>{state.memo}</div> : null}

                  <div className={styles.statementAccount}>
                    <span className={styles.statementAccountLabel}>정산금 입금계좌</span>
                    <b className={styles.statementAccountValue}>{accountLabel}</b>
                  </div>

                  <div className={styles.statementFooter}>
                    계산일수 {state.dDays} / {state.dTotal}일 기준 · 문의는 관리사무소로 연락 주세요.
                  </div>
                </div>
              </div>
              <div className={styles.statementActions}>
                <PartnerButton size="sm" variant="secondary" type="button" className="flex-1" onClick={() => setStatementOpen(false)}>
                  닫기
                </PartnerButton>
                <PartnerButton size="sm" variant="primary" type="button" className="flex-1" onClick={() => void saveStatementImage()} disabled={statementSavePending}>
                  이미지로 저장
                </PartnerButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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
          confirmVariant="ok"
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
      {confirmKind === "saveNegative" ? (
        <PartnerConfirmDialog
          title="입력값을 다시 확인해 주세요"
          description={`수납액이 미납 소계보다 많아 미수금이 ${won(totals.balance)}으로 계산됐어요. 저장할 수 없어요.`}
          confirmLabel="확인"
          onCancel={() => setConfirmKind(null)}
          onConfirm={() => setConfirmKind(null)}
        />
      ) : null}
      {confirmKind === "statementNegative" ? (
        <PartnerConfirmDialog
          title="입력값을 다시 확인해 주세요"
          description={`수납액이 미납 소계보다 많아 미수금이 ${won(totals.balance)}으로 계산됐어요. 내역서를 만들 수 없어요.`}
          confirmLabel="확인"
          onCancel={() => setConfirmKind(null)}
          onConfirm={() => setConfirmKind(null)}
        />
      ) : null}

      <PartnerToast message={toastMessage} />
    </div>
  );
}
