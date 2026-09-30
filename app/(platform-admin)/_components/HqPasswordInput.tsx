"use client";

import { forwardRef, useState } from "react";
import { Input } from "@/components/common";

type HqPasswordInputProps = React.ComponentProps<typeof Input> & {
  variant?: "default" | "plain";
};

export const HqPasswordInput = forwardRef<HTMLInputElement, HqPasswordInputProps>(
  function HqPasswordInput({ className = "", disabled, variant = "default", ...props }, ref) {
    const [visible, setVisible] = useState(false);
    const isPlain = variant === "plain";

    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={[
            isPlain ? "pr-[38px]" : "pr-10",
            className,
          ].filter(Boolean).join(" ")}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className={[
            isPlain
              ? "absolute right-2.5 top-1/2 flex size-[17px] -translate-y-1/2 cursor-pointer items-center justify-center text-t4"
              : "absolute right-1.5 top-1/2 flex size-[30px] -translate-y-1/2 items-center justify-center rounded-lg hover:bg-bg",
            // 색 유틸은 상태마다 하나만 둔다(둘 다 남으면 CSS 생성 순서가 이긴다).
            isPlain ? "" : visible ? "text-blue" : "text-t3",
            "disabled:cursor-not-allowed disabled:opacity-40",
          ].filter(Boolean).join(" ")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[17px]"
            aria-hidden="true"
          >
            <path d={isPlain ? "M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" : "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"} />
            <circle cx="12" cy="12" r={isPlain ? "2.6" : "3"} />
          </svg>
        </button>
      </div>
    );
  },
);

