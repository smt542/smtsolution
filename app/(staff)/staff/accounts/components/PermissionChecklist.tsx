"use client";
import type { ModuleKey } from "@/lib/auth/permissions";

const PERMISSION_GROUPS: {
  title: string;
  chips: { label: string; keys: readonly ModuleKey[] }[];
}[] = [
  {
    title: "관리업무",
    chips: [
      { label: "건물·입주자 관리", keys: ["buildings", "tenants"] },
      { label: "관리비 부과 세팅", keys: ["billing"] },
      { label: "항목등록 관리", keys: ["fee_items"] },
      { label: "서류 발행·출력", keys: ["bill_publish"] },
      { label: "미납 관리", keys: ["overdue"] },
      { label: "협력업체 관리", keys: ["vendors"] },
      { label: "장기수선비 관리", keys: ["long_term_repair"] },
      { label: "문자·알림톡 관리", keys: ["messaging"] },
      { label: "수납 처리", keys: ["payment"] },
      { label: "공지 관리", keys: ["notices"] },
      { label: "민원·AS", keys: ["complaints"] },
    ],
  },
  { title: "공과금 관리", chips: [{ label: "공과금 관리 전체", keys: ["utilities"] }] },
  { title: "이사정산", chips: [{ label: "이사정산 전체", keys: ["moving"] }] },
  {
    title: "설정",
    chips: [
      { label: "계정·직원", keys: ["accounts"] },
      { label: "셋업 설정", keys: ["settings"] },
    ],
  },
];

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  /** 마스터(전체 통과)면 모두 체크·비활성 표시 */
  allGranted?: boolean;
}

export function PermissionChecklist({ value, onChange, disabled, allGranted }: Props) {
  const toggle = (keys: readonly ModuleKey[]) => {
    if (disabled || allGranted) return;
    const granted = keys.every((key) => value.includes(key));
    if (granted) {
      onChange(value.filter((key) => !keys.includes(key as ModuleKey)));
      return;
    }
    onChange([...value, ...keys.filter((key) => !value.includes(key))]);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line p-4">
      {PERMISSION_GROUPS.map((group) => (
        <section key={group.title} aria-labelledby={`permission-${group.title}`}>
          <h4 id={`permission-${group.title}`} className="mb-2 text-xs font-medium text-t1">
            {group.title}
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.chips.map((chip) => {
              const granted = !!allGranted || chip.keys.every((key) => value.includes(key));
              return (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={granted}
                  disabled={disabled || allGranted}
                  onClick={() => toggle(chip.keys)}
                  className={`min-h-9 rounded-lg border px-2 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    granted
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-t1 hover:border-brand hover:text-brand"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
