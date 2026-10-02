import { PhoneText } from "@/components/common";
import { PhoneIcon } from "@/components/icons";

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

/** Pill-style phone link with a handset icon, for partner mobile screens. */
export function PartnerPhoneLink({ phone, pushRight, size = "default" }: PartnerPhoneLinkProps) {
  return (
    <a
      href={`tel:${phone}`}
      className={`inline-flex ${PILL_SIZE[size]} flex-none items-center gap-[5px] border border-line bg-white px-[11px] text-[13px] font-bold tabular-nums text-t2 ${pushRight ? "ml-auto" : ""}`}
    >
      <PhoneIcon className="h-3.5 w-3.5 text-blue" />
      <PhoneText value={phone} />
    </a>
  );
}
