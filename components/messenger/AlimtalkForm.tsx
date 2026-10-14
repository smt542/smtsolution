"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/common";
import { useMessageTemplates } from "@/hooks/reactquery/messageTemplates/queries";
import type { MessageTemplate } from "@/hooks/reactquery/messageTemplates/apis";
import { messengerClasses as styles } from "./messengerClasses";
import { DYNAMIC_VARIABLE_NAMES, type AlimtalkDynamicKind } from "./useAlimtalkDynamicVariables";

export const AUTO_VARS = new Set([
  "링크토큰",
  "상세링크",
  "공지ID",
  "이름",
  "건물명",
  "호실",
  "호수",
  "세대",
  "입주자명",
  "건물주명",
  "청소담당자명",
  "고객번호",
  "건물코드+입주자코드",
  "관리비기간",
  "관리비 정산 기간",
  "청구월",
  "납기일",
  "관리비 납부 기한일",
  "출금예정일",
  "당월관리비",
  "당월 총 관리비",
  "청구금액",
  "미납관리비",
  "이전 미납 관리비 총액",
  "미납금액",
  "미납월",
  "총납부금액",
  "총 납부해야할 금액",
  "납부계좌",
  "관리실연락처",
  "관리실 번호",
  "관리사무소연락처",
  "금액",
  "년",
  "월",
  "년도",
]);

interface TemplateWithStatus extends MessageTemplate {
  status?: string | null;
  approvalStatus?: string | null;
  alimtalkStatus?: string | null;
}

/** 승인 템플릿 자동 채움(관리비 고지 부과월·공지 선택) — MessengerFab 이 useAlimtalkDynamicVariables 로 만든다. */
export interface AlimtalkDynamicControls {
  kind: NonNullable<AlimtalkDynamicKind>;
  /** 'YYYY-MM-01' */
  period: string;
  onPeriod: (period: string) => void;
  noticeId: number | null;
  onNotice: (noticeId: number | null) => void;
  notices: { id: number; title: string }[];
  /** 제외 수신자 등 안내(없으면 null). */
  hint: string | null;
}

interface AlimtalkFormProps {
  templateId: number | null;
  onTemplate: (templateId: number | null) => void;
  vars: Record<string, string>;
  onVars: (vars: Record<string, string>) => void;
  dynamic?: AlimtalkDynamicControls | null;
}

export function extractAlimtalkVariables(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(/#?\{([^}]+)\}/g)) {
    const name = match[1].trim();
    if (name) found.add(name);
  }
  return [...found];
}

function isApproved(template: TemplateWithStatus): boolean {
  const rawStatus =
    template.status ?? template.approvalStatus ?? template.alimtalkStatus;
  if (!rawStatus) return Boolean(template.alimtalkTemplateCode);
  return ["approved", "approve", "ok", "active", "승인", "승인완료"].includes(
    rawStatus.toLocaleLowerCase(),
  );
}

function templateKind(template: MessageTemplate): "recurring" | "notice" {
  return ["bill", "overdue", "recurring", "정기"].includes(
    template.category ?? "",
  )
    ? "recurring"
    : "notice";
}

function TokenizedBody({ body }: { body: string }) {
  const parts = body.split(/(#?\{[^}]+\})/g);
  return (
    <>
      {parts.map((part, index) =>
        /^#?\{[^}]+\}$/.test(part) ? (
          <span className={styles["ak-tok"]} key={`${part}-${index}`}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function AlimtalkForm({
  templateId,
  onTemplate,
  vars,
  onVars,
  dynamic = null,
}: AlimtalkFormProps) {
  const { data: allTemplates = [], isLoading, isFetching, isError } = useMessageTemplates();
  const isTemplateListRefreshing = isFetching && !isLoading;
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<
    { left: number; top: number; width: number } | undefined
  >();
  const rootRef = useRef<HTMLDivElement>(null);
  const templates = useMemo(
    () =>
      allTemplates.filter(
        (template) =>
          template.channelType === "alimtalk" &&
          Boolean(template.alimtalkTemplateCode),
      ) as TemplateWithStatus[],
    [allTemplates],
  );
  const selected = templates.find((template) => template.id === templateId) ?? null;
  // 자동 채움 템플릿은 그 변수들을 입력받지 않는다(수신자별 고지 정보·선택한 공지로 채움).
  const manualVariables = selected
    ? extractAlimtalkVariables(selected.body).filter(
        (name) => !AUTO_VARS.has(name) && !(dynamic && DYNAMIC_VARIABLE_NAMES.has(name)),
      )
    : [];

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  // 정본(Messenger.dc.html #akTplSel)은 SMS와 동일한 .fmp-tplsel "≡ 템플릿" 버튼으로
  // 승인 템플릿을 고른다. 메뉴는 우측 정렬 팝업(.fmp-tplmenu)이라 버튼 위치 기준으로 배치.
  const toggleTemplates = () => {
    if (!open && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      setMenuPosition({
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        top: rect.bottom + 6,
        width,
      });
    }
    setOpen((current) => !current);
  };

  const chooseTemplate = (template: TemplateWithStatus) => {
    if (!isApproved(template)) return;
    const nextVariables = Object.fromEntries(
      extractAlimtalkVariables(template.body)
        .filter((name) => !AUTO_VARS.has(name))
        .map((name) => [name, ""]),
    );
    onTemplate(template.id);
    onVars(nextVariables);
    setOpen(false);
  };

  const kind = selected ? templateKind(selected) : "notice";

  return (
    <div className={`${styles["fmp-akwrap"]} flex`}>
      {/* 정본: "템플릿 내용" 라벨 + 우측 "≡ 템플릿" 버튼(.fmp-tplsel, SMS와 동일 스타일) */}
      <div
        className={`${styles["fmp-lbl"]} flex items-center justify-between mb-2`}
        // .fmp-akwrap는 gap:8이라 라벨→akForm 간격이 +8 된다. 정본(16px)에 맞춰 margin은 8만.
      >
        <span>템플릿 내용</span>
        <div
          ref={rootRef}
          className={`${styles["fmp-tplsel"]} ${open ? styles.open : ""}`}
        >
          <button
            type="button"
            onClick={toggleTemplates}
            aria-expanded={open}
            className="inline-flex items-center gap-[5px] whitespace-nowrap"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="flex-none"
            >
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
            템플릿
            <svg
              className={`cv ${styles.cv}`}
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <div
            className={`menu ${styles.menu} ${styles["fmp-tplmenu"]}`}
            style={menuPosition}
            onClick={(event) => event.stopPropagation()}
          >
            {isLoading && (
              <div className={styles["fmp-pempty"]} role="status" aria-label="알림톡 템플릿 불러오는 중">템플릿을 불러오는 중입니다.</div>
            )}
            {isError && (
              <div className={styles["fmp-pempty"]} role="alert">알림톡 템플릿을 불러오지 못했습니다.</div>
            )}
            {isTemplateListRefreshing && (
              <div className={styles["fmp-pempty"]} role="status" aria-label="알림톡 템플릿 갱신 중">템플릿을 갱신하는 중입니다.</div>
            )}
            {!isLoading && !isError && templates.length === 0 && (
              <div className={styles["fmp-pempty"]}>
                승인 코드가 등록된 알림톡 템플릿이 없습니다.
              </div>
            )}
            {!isError && templates.map((template) => {
              const approved = isApproved(template);
              const optionKind = templateKind(template);
              return (
                <button
                  type="button"
                  key={template.id}
                  className={`${styles["ak-opt"]} ${!approved ? styles.disabled : ""}`}
                  onClick={() => chooseTemplate(template)}
                  disabled={!approved}
                >
                  <span className={styles["ak-opt-h"]}>
                    <span className={`${styles["ak-type"]} ${styles[optionKind]}`}>
                      {optionKind === "recurring" ? "정기" : "공지"}
                    </span>
                    <span className={styles.nm}>{template.title}</span>
                    <span
                      className={`${styles["ak-status"]} ${approved ? styles.ok : styles.wait}`}
                    >
                      {approved ? "승인" : "미승인"}
                    </span>
                  </span>
                  <span className={styles["ak-opt-b"]}>
                    {template.body.replace(/\s+/g, " ")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`${styles["fmp-akform"]} flex`}>
        {!selected ? (
          <div className={styles["ak-emptyhint"]}>
            우측 <b>템플릿</b> 버튼에서 승인 템플릿을 선택하면
            <br />채워 넣을 항목이 여기에 표시돼요.
          </div>
        ) : (
          <>
            <div className={styles["ak-fhead"]}>
              <span className={`${styles["ak-type"]} ${styles[kind]}`}>
                {kind === "recurring" ? "정기" : "공지"}
              </span>
              <span className={styles["ak-fname"]}>{selected.title}</span>
            </div>
            <div className={styles["ak-readonly"]}>
              <div className={styles["ak-ro-lbl"]}>템플릿 내용</div>
              <div className={styles["ak-ro-body"]}>
                <TokenizedBody body={selected.body} />
              </div>
            </div>
            {dynamic && (
              <div className={styles["ak-vars"]}>
                {dynamic.kind.type === "bill" ? (
                  <div className={styles["ak-vrow"]}>
                    <label htmlFor="messenger-alim-period">부과월</label>
                    <Input
                      unstyled
                      id="messenger-alim-period"
                      type="month"
                      value={dynamic.period.slice(0, 7)}
                      onChange={(event) => {
                        if (/^\d{4}-\d{2}$/.test(event.target.value)) dynamic.onPeriod(`${event.target.value}-01`);
                      }}
                    />
                  </div>
                ) : (
                  <div className={styles["ak-vrow"]}>
                    <label htmlFor="messenger-alim-notice">공지</label>
                    <select
                      id="messenger-alim-notice"
                      className="h-9 min-w-0 flex-1 rounded-[9px] border border-line bg-white px-[11px] text-[13px] outline-none focus:border-blue"
                      value={dynamic.noticeId ?? ""}
                      onChange={(event) => dynamic.onNotice(event.target.value ? Number(event.target.value) : null)}
                    >
                      <option value="">보낼 공지를 선택해 주세요</option>
                      {dynamic.notices.map((notice) => (
                        <option key={notice.id} value={notice.id}>{notice.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
            {manualVariables.length > 0 && (
              <div className={styles["ak-vars"]}>
                {manualVariables.map((name) => (
                  <div className={styles["ak-vrow"]} key={name}>
                    <label htmlFor={`messenger-alim-${name}`}>{name}</label>
                    <Input
                      unstyled
                      id={`messenger-alim-${name}`}
                      value={vars[name] ?? ""}
                      placeholder={`${name} 입력`}
                      onChange={(event) =>
                        onVars({ ...vars, [name]: event.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            <div className={styles["fmp-akhint"]}>
              {dynamic?.kind.type === "bill"
                ? "고른 부과월의 부과 확정 내역으로 세대별 금액·납부 마감일·고객번호·고지서 상세 링크가 자동 입력됩니다."
                : dynamic?.kind.type === "notice"
                  ? "선택한 공지의 제목과 공지 확인 링크가 자동 입력됩니다."
                  : "수신자 정보 변수는 각 대상의 데이터로 자동 입력됩니다."}
              {dynamic?.hint ? <><br />{dynamic.hint}</> : null}
            </div>
            {selected.buttons[0] && (
              <div className={styles["ak-btnbox"]}>
                <div className={styles["ak-btnlbl"]}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
                    <path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
                  </svg>
                  버튼
                </div>
                <div className={styles["ak-btnview"]}>
                  <b>{selected.buttons[0].name}</b>
                  <i>{selected.buttons[0].url || "템플릿에 설정된 링크"}</i>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
