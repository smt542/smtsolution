import React from "react";

export type PanelVariant = "default" | "compact";

export type PanelProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  variant?: PanelVariant;
  className?: string;
  actionClassName?: string;
};

export function Panel({
  title,
  subtitle,
  action,
  children,
  flush = false,
  variant = "default",
  className = "",
  actionClassName = "",
}: PanelProps) {
  if (flush) {
    return (
      <section className={`flex flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(23,31,40,0.05)] ${className}`}>
        <div className={`flex justify-between border-b border-line2 px-[18px] py-[15px] ${subtitle ? "items-start" : "items-center"}`}>
          {subtitle ? (
            <div>
              <h3 className="text-[15px] font-extrabold leading-[normal] text-t1">{title}</h3>
              <p className="h-[18px] pt-[3px] text-[12.5px] font-medium leading-[15px] text-t3">{subtitle}</p>
            </div>
          ) : (
            <h3 className="text-[15px] font-extrabold leading-[normal] text-t1">{title}</h3>
          )}
          {action && <div className={`ml-auto ${actionClassName}`}>{action}</div>}
        </div>
        {children}
      </section>
    );
  }

  if (variant === "compact") {
    return (
      <section className={`flex flex-col overflow-clip rounded-[16px] border border-[#dce1e7] bg-white ${className}`}>
        <div className="flex items-start justify-between px-[18px] pt-[16px]">
          <div>
            <h3 className="text-[15px] font-extrabold leading-[18px] tracking-[-0.15px] text-t1">{title}</h3>
            {subtitle && (
              <p className="h-[18px] pt-[3px] text-[12.5px] font-medium leading-[15px] text-t3">{subtitle}</p>
            )}
          </div>
          {action && <div className={`ml-auto ${actionClassName}`}>{action}</div>}
        </div>
        <div className="px-[18px] pb-[18px] pt-[14px]">{children}</div>
      </section>
    );
  }

  return (
    <section className={`rounded-2xl border border-line bg-surface p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        {subtitle ? (
          <div>
            <h3 className="text-base font-extrabold text-t1">{title}</h3>
            <p className="h-[18px] pt-[3px] text-[12.5px] font-medium leading-[15px] text-t3">{subtitle}</p>
          </div>
        ) : (
          <h3 className="text-base font-extrabold text-t1">{title}</h3>
        )}
        {action && <div className={`ml-auto ${actionClassName}`}>{action}</div>}
      </div>
      {children}
    </section>
  );
}
