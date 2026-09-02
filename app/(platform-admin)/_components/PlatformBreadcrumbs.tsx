import { Fragment, type ReactNode } from "react";
import Link from "next/link";

export interface PlatformBreadcrumbItem {
  label: ReactNode;
  href?: string;
}

/**
 * Small-text linked breadcrumb trail. Every item except the last renders as a
 * link (when it has an href); the last item renders as plain text. Items are
 * separated by a "›" glyph.
 */
export function PlatformBreadcrumbs({ items }: { items: PlatformBreadcrumbItem[] }) {
  return (
    <nav className="mb-3 text-xs text-t3">
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="mx-1.5">›</span>}
          {item.href ? (
            <Link href={item.href} className="hover:underline">
              {item.label}
            </Link>
          ) : (
            item.label
          )}
        </Fragment>
      ))}
    </nav>
  );
}
