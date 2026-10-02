import React from "react";
import { CloseIcon } from "@/components/icons";
import { Input } from "./Input";

export type NumberedTagItem = {
  id: string;
  label: string;
};

export type NumberedTagListProps = {
  items: NumberedTagItem[];
  columns: number;
  /** 정본 `.st-ck*` 규격을 쓰는 셋업 화면 전용 오버라이드. 기본 레이아웃은 유지한다. */
  canonical?: boolean;
  /** 입력 중(키 입력마다). 부모의 초안 상태를 갱신한다. */
  onChange: (id: string, label: string) => void;
  /** 확정(blur 또는 Enter). 여기서만 저장한다. */
  onCommit: (id: string, label: string) => void;
  onDelete: (id: string) => void;
  /**
   * 추가 버튼은 가득 차도 늘 이것을 부른다. 최대 개수 판단과
   * 안내 토스트('항목은 최대 24개까지예요 처리되었습니다')는 부모가 한다 — 정본 `#ckAdd`·`#asAdd` 클릭 처리와 같다.
   */
  onAdd: () => void;
  addLabel: string;
  /** 최대 개수에 닿았으면 추가 버튼을 흐린 모양으로 그린다(클릭은 그대로 onAdd). */
  full?: boolean;
  className?: string;
};

/**
 * 번호 붙은 인풋 목록.
 *
 * 내부 상태를 갖지 않는 완전 controlled 컴포넌트다. **입력과 저장을 분리한다** —
 * 이 목록이 붙는 마스터 테이블들은 `(org_id, label)` 유니크 제약이 있어서 키 입력마다
 * 저장하면 타이핑 도중의 중간 문자열이 그대로 제약에 걸린다.
 */
export function NumberedTagList({
  items,
  columns,
  onChange,
  onCommit,
  onDelete,
  onAdd,
  addLabel,
  className = "",
  canonical = false,
  full = false,
}: NumberedTagListProps) {
  return (
    <div className={className}>
      <div
        className={`grid ${canonical ? "grid-cols-[repeat(auto-fill,minmax(260px,1fr))] leading-[normal]" : "grid-cols-[repeat(var(--numbered-tag-columns),minmax(0,1fr))]"} gap-[8px]`}
        style={canonical ? undefined : { "--numbered-tag-columns": columns } as React.CSSProperties}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className={canonical
              ? "flex min-w-0 items-center gap-[8px] rounded-[12px] border border-line2 bg-bg py-[7px] pl-[10px] pr-[8px]"
              : "flex h-[52px] min-w-0 items-center gap-[8px] rounded-[12px] border border-line2 bg-bg pl-[11px] pr-[9px]"}
          >
            <span className={canonical
              ? "w-[22px] shrink-0 text-center text-[12px] font-bold leading-[normal] text-t4 tabular-nums"
              : "w-[22px] shrink-0 text-[13px] font-bold leading-none text-t4 tabular-nums"}
            >
              {index + 1}
            </span>
            <Input
              size="36"
              aria-label={`항목 ${index + 1}`}
              value={item.label}
              onChange={(event) => onChange(item.id, event.target.value)}
              onBlur={(event) => onCommit(item.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="min-w-0 flex-1"
            />
            <button
              type="button"
              aria-label={`${item.label} 삭제`}
              onClick={() => onDelete(item.id)}
              // 정본 `.st-ck-x:hover`·`.st-as-x:hover{background:#FFECEC;color:var(--red)}`
              className="grid size-[28px] shrink-0 place-items-center rounded-[8px] text-t4 hover:bg-[#FFECEC] hover:text-danger"
            >
              <CloseIcon className="size-[14px]" />
            </button>
          </div>
        ))}
      </div>
      {/* 정본은 추가 버튼이 그리드 아래 왼쪽에 단독으로 놓인다.
          `n / max` 카운터는 이 목록이 아니라 카드 헤더 우측에 있으므로(Panel의 action)
          여기서 그리지 않는다.
          규격은 정본 `.st-ck-add`(카드 본문 gap 10 + margin-top 2, 점선 #C9D0D8, 폭은 글자에 맞춤).
          hover 는 글자만 청록 — 테두리 변화는 QA S26 에서 뺐다.
          가득 차면(full) Figma 924:203856 — 실선 테두리·45% 흐림·hover 없음. 누르면 토스트는 그대로 뜬다
          (3차 QA·사용자 결정 2026-10-02). */}
      <button
        type="button"
        onClick={onAdd}
        aria-disabled={full || undefined}
        className={`mt-[12px] h-[38px] rounded-[11px] border border-[#C9D0D8] bg-white px-[16px] text-[13px] font-bold leading-[normal] text-t2 ${full ? "opacity-[0.45]" : "border-dashed hover:text-brand"}`}
      >
        {addLabel}
      </button>
    </div>
  );
}

/**
 * 새 항목의 기본 이름. 이 목록이 붙는 마스터 테이블들은 `(org_id, label)`이 유니크라
 * 같은 기본 이름을 연속으로 추가하면 두 번째가 제약에 걸린다. 비어 있는 번호를 찾아 붙인다.
 */
export function nextDefaultLabel(existing: string[], base: string): string {
  if (!existing.includes(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base} ${n}`;
    if (!existing.includes(candidate)) return candidate;
  }
}
