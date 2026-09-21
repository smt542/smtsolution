"use client";

import { useRevealPii } from "@/hooks/reactquery/pii/mutations";
import { maskValue, type MaskKind } from "@/lib/privacy/mask";

export type MaskedPhoneReveal = {
  targetKind: string;
  targetId: string | number;
  field: string;
};

export function MaskedPhone({
  value,
  kind,
  reveal,
  asTelLink = false,
  alreadyMasked = false,
}: {
  value: string | null | undefined;
  kind: MaskKind;
  reveal: MaskedPhoneReveal;
  asTelLink?: boolean;
  alreadyMasked?: boolean;
}) {
  const revealMutation = useRevealPii();
  const maskedValue = alreadyMasked ? value ?? "" : maskValue(kind, value);
  const isRevealed = revealMutation.isSuccess;
  const isRevealing = revealMutation.isPending;
  const revealedValue = revealMutation.data ?? null;
  const fieldLabel = kind === "fax" ? "팩스번호" : "전화번호";

  const revealedContent = asTelLink && revealedValue ? (
    <a className="text-brand underline" href={`tel:${revealedValue}`}>
      {revealedValue}
    </a>
  ) : (
    revealedValue ?? ""
  );

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{isRevealed ? revealedContent : maskedValue}</span>
      {!isRevealed ? (
        <button
          type="button"
          className="rounded px-1 py-0.5 text-xs font-bold text-brand hover:bg-blue-t2 disabled:cursor-wait disabled:opacity-60"
          disabled={isRevealing}
          onClick={(event) => {
            event.stopPropagation();
            revealMutation.mutate(reveal);
          }}
          aria-label={`${fieldLabel} 원문 보기`}
        >
          {isRevealing ? "불러오는 중" : "원문"}
        </button>
      ) : null}
      {revealMutation.isError ? (
        <span role="alert" className="text-xs text-danger">
          원문을 불러오지 못했습니다.
        </span>
      ) : null}
    </span>
  );
}
