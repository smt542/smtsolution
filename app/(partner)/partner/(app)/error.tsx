"use client";

import { RouteErrorFallback } from "@/components/common";

export default function Error(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteErrorFallback {...props} />;
}
