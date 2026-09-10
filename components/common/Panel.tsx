import React from "react";

export function Panel({
  title,
  action,
  children,
  flush = false,
  className = "",
  actionClassName = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  className?: string;
  actionClassName?: string;
}) {
  if (flush) {
    return (
      <section className={`flex flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_1px_3px_rgba(23,31,40,0.05)] ${className}`}>
        <div className="flex items-center justify-between border-b border-line2 px-[18px] py-[15px]">
          <h3 className="text-[15px] font-extrabold leading-[normal] text-t1">{title}</h3>
          {action && <div className={`ml-auto ${actionClassName}`}>{action}</div>}
        </div>
        {children}
      </section>
    );
  }

  return (
    <section className={`rounded-2xl border border-line bg-surface p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-extrabold text-t1">{title}</h3>
        {action && <div className={`ml-auto ${actionClassName}`}>{action}</div>}
      </div>
      {children}
    </section>
  );
}
