import { PhoneText } from "@/components/common";

type PartnerPhoneLinkProps = {
  /** Phone number to display. */
  phone: string;
  /** Adds `margin-left: auto` for a pill placed directly in a flex row. */
  pushRight?: boolean;
  /** 정본 `.btel` 규격. 기본 32px/r10, `lg`는 검침 자료 카드 34px/r11. */
  size?: "default" | "lg";
};

const PILL_SIZE = {
  default: "h-8 rounded-[10px]",
  lg: "h-[34px] rounded-[11px]",
} as const;

function PhoneIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z" />
    </svg>
  );
}

/** Pill-style phone link with a handset icon, for partner mobile screens. */
export function PartnerPhoneLink({ phone, pushRight, size = "default" }: PartnerPhoneLinkProps) {
  return (
    <a
      href={`tel:${phone}`}
      className={`inline-flex ${PILL_SIZE[size]} flex-none items-center gap-[5px] border border-line bg-white px-[11px] text-[13px] font-bold tabular-nums text-t2 ${pushRight ? "ml-auto" : ""}`}
    >
      <PhoneIcon />
      <PhoneText value={phone} />
    </a>
  );
}
