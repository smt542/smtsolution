import React from "react";

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-extrabold text-t1">{title}</h3>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}
