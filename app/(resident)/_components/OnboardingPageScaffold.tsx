import type { ReactNode } from "react";

import styles from "./OnboardingPageScaffold.module.css";

type OnboardingPageScaffoldBaseProps = {
  title: ReactNode;
  lead: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
};

type OnboardingPageScaffoldProps =
  | ({
      variant: "flow";
      onBack: () => void;
      backLabel: string;
    } & OnboardingPageScaffoldBaseProps)
  | ({
      variant: "block" | "center";
    } & OnboardingPageScaffoldBaseProps);

const bodyClassByVariant = {
  flow: styles.flowBody,
  block: styles.blockBody,
  center: styles.centerBody,
} as const;

const titleClassByVariant = {
  flow: styles.flowTitle,
  block: styles.blockTitle,
  center: styles.centerTitle,
} as const;

const leadClassByVariant = {
  flow: styles.flowLead,
  block: styles.blockLead,
  center: styles.centerLead,
} as const;

export default function OnboardingPageScaffold(
  props: OnboardingPageScaffoldProps,
) {
  const { variant, title, lead, icon, children, footer } = props;

  return (
    <>
      {props.variant === "flow" ? (
        <div className={styles.hdr}>
          <button
            type="button"
            className={styles.bk}
            aria-label={props.backLabel}
            onClick={props.onBack}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        </div>
      ) : null}
      <div className={bodyClassByVariant[variant]}>
        {icon}
        <h1 className={titleClassByVariant[variant]}>{title}</h1>
        <p className={leadClassByVariant[variant]}>{lead}</p>
        {children}
      </div>
      <div className={styles.foot}>{footer}</div>
    </>
  );
}
