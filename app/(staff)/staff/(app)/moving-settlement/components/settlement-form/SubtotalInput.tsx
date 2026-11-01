import { Input } from "@/components/common";

/**
 * 소계 수기 수정 입력(QA #49, extra.subtotalOverride). 표시값 = override ?? 자동값.
 * 비우거나 자동값과 같은 값을 넣으면 override 를 해제(null)해 자동 계산값으로 돌아간다.
 */
export function SubtotalInput({
  label,
  autoValue,
  override,
  onOverrideChange,
  className,
}: {
  label: string;
  autoValue: number;
  override: number | null | undefined;
  onOverrideChange: (next: number | null) => void;
  className: string;
}) {
  return (
    <Input
      unstyled
      aria-label={label}
      title={override != null ? `직접 수정한 값 (자동 계산 ${autoValue.toLocaleString("ko-KR")}원) — 비우면 자동 계산값으로 돌아가요` : undefined}
      type="number"
      min={0}
      step={1}
      value={override ?? autoValue}
      onChange={(event) => {
        const raw = event.target.value;
        const parsed = Number(raw);
        if (raw === "" || !Number.isFinite(parsed)) {
          onOverrideChange(null);
          return;
        }
        const next = Math.max(0, Math.round(parsed));
        onOverrideChange(next === autoValue ? null : next);
      }}
      className={className}
    />
  );
}

/** 섹션 소계(①②③) 자리: 기존 `<strong>` 금액과 같은 글자 규격으로 보이고 포커스 때만 밑줄이 보인다. */
export const SECTION_SUBTOTAL_INPUT_CLASS =
  "ml-[10px] h-[21px] w-[130px] border-0 border-b border-transparent bg-transparent p-0 text-right text-[17px] font-extrabold leading-[21px] tracking-[-0.17px] text-teal-d outline-none [appearance:textfield] focus:border-teal [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
