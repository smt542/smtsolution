"use client";

import dynamic from "next/dynamic";
import { Spinner } from "@/components/common";

export const LazyBankImportModal = dynamic(
  () => import("./BankImportModal").then((module) => module.BankImportModal),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center">
        <Spinner />
      </div>
    ),
  },
);
