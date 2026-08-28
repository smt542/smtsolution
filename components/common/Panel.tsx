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
      <section className={`overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>
        <div className="flex h-[56px] items-center justify-between border-b border-line px-[18px]">
          <h3 className="text-[16px] font-extrabold text-t1">{title}</h3>
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
