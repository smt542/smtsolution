import type { ReactNode } from "react";

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
  flow: "flex min-h-0 flex-1 flex-col overflow-auto px-7 pb-2 pt-2.5",
  block: "flex min-h-0 flex-1 flex-col overflow-auto px-7 pb-2 pt-[calc(env(safe-area-inset-top)+44px)]",
  center: "flex min-h-0 flex-1 flex-col items-center overflow-auto px-7 pb-2 pt-[calc(env(safe-area-inset-top)+46px)] text-center",
} as const;

const titleClassByVariant = {
  flow: "mt-2 text-[24px] font-extrabold leading-[1.38] tracking-[-0.03em] animate-[rise_0.5s_cubic-bezier(0.22,0.61,0.36,1)_both]",
  block: "mt-[18px] text-[24px] font-extrabold leading-[1.38] tracking-[-0.03em] animate-[rise_0.5s_60ms_cubic-bezier(0.22,0.61,0.36,1)_both]",
  center: "mt-5 text-[24px] font-extrabold leading-[1.38] tracking-[-0.03em] animate-[rise_0.5s_60ms_cubic-bezier(0.22,0.61,0.36,1)_both]",
} as const;

const leadClassByVariant = {
  flow: "mt-2.5 text-[14.5px] font-semibold leading-[1.62] text-t3 animate-[rise_0.5s_60ms_cubic-bezier(0.22,0.61,0.36,1)_both]",
  block: "mt-2.5 text-[14.5px] font-semibold leading-[1.62] text-t3 animate-[rise_0.5s_100ms_cubic-bezier(0.22,0.61,0.36,1)_both]",
  center: "mt-2.5 text-[14.5px] font-semibold leading-[1.62] text-t3 animate-[rise_0.5s_100ms_cubic-bezier(0.22,0.61,0.36,1)_both]",
} as const;

export default function OnboardingPageScaffold(
  props: OnboardingPageScaffoldProps,
) {
  const { variant, title, lead, icon, children, footer } = props;

  return (
    <>
      {props.variant === "flow" ? (
        <div className="flex flex-none items-center px-3 pb-1 pt-[calc(env(safe-area-inset-top)+12px)]">
          <button
            type="button"
            className="flex size-[38px] items-center justify-center rounded-xl bg-transparent text-t2 hover:bg-bg [&_svg]:size-[22px]"
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
      <div className="flex flex-none flex-col gap-2.5 px-7 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-3.5">{footer}</div>
    </>
  );
}
