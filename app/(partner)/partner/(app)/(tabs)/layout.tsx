import type { ReactNode } from "react";

import { PartnerNav } from "./PartnerNav";
export default function PartnerTabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      <PartnerNav />
    </div>
  );
}
