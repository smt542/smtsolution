"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/common";
import { messengerClasses as styles } from "./messengerClasses";

// 메신저 .fmp-dd2 [&_.menu] 스타일과 같은 값. portal 로 트리거 밖에 그려 descendant 셀렉터가 닿지 않으므로 직접 준다.
const MENU_CLASS =
  "fixed z-[70] flex max-h-[300px] flex-col gap-0.5 overflow-hidden rounded-xl border border-line bg-white p-1.5 text-[13.5px] font-bold shadow-[0_16px_40px_-12px_rgba(23,31,40,0.3)]";

export interface RecipientCheckOption {
  /** 선택 키(입주자는 occupancyId 등). */
  key: number;
  name: string | null;
  /** 오른쪽 보조 표기(호수 · 건물명 호수). */
  sub: string;
}

/**
 * 체크박스 다중 선택 드롭다운 — 메신저 「수신자」의 입주자 선택(RecipientCascade 3단)과 같은 모양·동작.
 * 메뉴는 body 로 portal 해 fixed 로 띄운다. 모달 카드처럼 filter(drop-shadow)·transform 이 있는 조상 안에서는
 * fixed 가 그 조상 기준이 되어 overflow 에 잘리므로, 조상 밖으로 빼야 화면 기준으로 펼쳐진다. 모달(z-50) 위로 올린다.
 */
export function RecipientCheckSelect({
  options,
  selectedKeys,
  onChange,
  loading = false,
  disabled = false,
  placeholder = "입주자 선택",
  searchPlaceholder = "호수·이름 검색",
  emptyText = "전화번호가 등록된 입주자가 없습니다.",
}: {
  options: RecipientCheckOption[];
  selectedKeys: ReadonlySet<number>;
  onChange: (next: Set<number>) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<{ left: number; top: number; width: number } | null>(null);

  const selectedOptions = options.filter((option) => selectedKeys.has(option.key));
  const allSelected = options.length > 0 && selectedOptions.length === options.length;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) =>
      `${option.name ?? ""} ${option.sub}`.toLowerCase().includes(query));
  }, [options, search]);

  // 트리거 문구: 메신저와 같은 형식(전체 (N명) / 호수 이름 / 첫 이름 외 N명).
  const label = loading
    ? "입주자를 불러오는 중…"
    : selectedOptions.length === 0
      ? placeholder
      : allSelected
        ? `전체 (${options.length}명)`
        : selectedOptions.length === 1
          ? `${selectedOptions[0].sub} ${selectedOptions[0].name ?? ""}`.trim()
          : `${selectedOptions[0].name ?? selectedOptions[0].sub} 외 ${selectedOptions.length - 1}명`;

  useEffect(() => {
    if (!open) return;
    // 메뉴는 portal 이라 트리거 밖에 있다 — 트리거·메뉴 둘 다 바깥일 때만 닫는다.
    const isInside = (target: EventTarget | null) =>
      rootRef.current?.contains(target as Node) || menuRef.current?.contains(target as Node);
    const close = (event: MouseEvent) => {
      if (!isInside(event.target)) setOpen(false);
    };
    // 모달 본문이 스크롤되면 fixed 메뉴가 트리거에서 떨어지므로 닫는다(메뉴 목록 스크롤은 제외).
    const closeOnScroll = (event: Event) => {
      if (!isInside(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", closeOnScroll);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", closeOnScroll);
    };
  }, [open]);

  const toggleOpen = () => {
    if (disabled || loading) return;
    if (open) {
      setOpen(false);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setPosition({ left: rect.left, top: rect.bottom + 6, width: rect.width });
    setOpen(true);
  };

  const toggleOne = (key: number) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  const toggleAll = () => {
    onChange(allSelected ? new Set() : new Set(options.map((option) => option.key)));
  };

  const interactive = !disabled && !loading;

  const menuNode = (
    <div
      ref={menuRef}
      className={MENU_CLASS}
      role="listbox"
      aria-multiselectable="true"
      style={position ? { left: position.left, top: position.top, width: position.width } : undefined}
      onClick={(event) => event.stopPropagation()}
    >
      <div className={styles.ddsrch}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" />
        </svg>
        <Input
          unstyled
          value={search}
          placeholder={searchPlaceholder}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {options.length > 0 && (
        <div
          role="option"
          aria-selected={allSelected}
          className={`${styles.opt} ${styles.chk} ${allSelected ? styles["chk-on"] : styles["chk-off"]}`}
          onClick={toggleAll}
        >
          전체 ({options.length}명)
        </div>
      )}
      <div className={styles.ddopts}>
        {filtered.map((option) => {
          const checked = selectedKeys.has(option.key);
          return (
            <div
              key={option.key}
              role="option"
              aria-selected={checked}
              className={`${styles.opt} ${styles.tnl} ${checked ? styles.on : ""}`}
              onClick={() => toggleOne(option.key)}
            >
              <span className={`${styles.cbx} ${checked ? styles["cbx-on"] : styles["cbx-off"]}`} />
              <span className={styles["ow-av"]}>{(option.name ?? option.sub).slice(0, 1)}</span>
              <span className={styles["tnl-nm"]}>{option.name ?? "이름 미등록"}</span>
              <span className={styles["tnl-ho"]}>{option.sub}</span>
            </div>
          );
        })}
        {filtered.length === 0 && <div className={styles["fmp-pempty"]}>{emptyText}</div>}
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`fmp-dd2 ${styles["fmp-dd2"]} ${interactive ? styles["dd2-on"] : "cursor-not-allowed bg-bg text-t3"} ${selectedOptions.length === 0 ? styles.ph : ""} ${open ? styles.open : ""}`}
      onClick={toggleOpen}
      role="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-disabled={!interactive}
    >
      <span className={`v ${styles.v}`}>{label}</span>
      <svg
        className={`cv ${styles.cv}`}
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="#8B95A1"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
      {open && position && typeof document !== "undefined"
        ? createPortal(menuNode, document.body)
        : null}
    </div>
  );
}
