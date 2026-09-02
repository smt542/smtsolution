import type { ReactNode } from "react";

interface PlatformPageContainerProps {
  maxWidthClassName?: string;
  children: ReactNode;
}

/**
 * Centered, responsively padded page wrapper shared by platform-admin screens.
 * Only the max-width varies by site — pass maxWidthClassName to override the
 * default (max-w-7xl).
 */
export function PlatformPageContainer({
  maxWidthClassName = "max-w-7xl",
  children,
}: PlatformPageContainerProps) {
  return (
    <div className={`mx-auto w-full ${maxWidthClassName} p-5 sm:p-6 lg:p-8`}>
      {children}
    </div>
  );
}
