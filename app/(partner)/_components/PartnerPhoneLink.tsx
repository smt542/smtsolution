import styles from "./PartnerPhoneLink.module.css";

type PartnerPhoneLinkProps = {
  /** Raw phone number to display; non-digit characters are stripped for the `tel:` href. */
  phone: string;
  /** Adds `margin-left: auto` — for a pill placed directly in a flex row with no other spacer/`justify-content`. */
  pushRight?: boolean;
};

function telHref(v: string) {
  return `tel:${v.replace(/[^0-9]/g, "")}`;
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z" />
    </svg>
  );
}

/** Pill-style `tel:` link with a handset icon, for partner mobile screens. */
export function PartnerPhoneLink({ phone, pushRight }: PartnerPhoneLinkProps) {
  return (
    <a className={pushRight ? `${styles.tel} ${styles.pushRight}` : styles.tel} href={telHref(phone)}>
      <PhoneIcon />
      {phone}
    </a>
  );
}
