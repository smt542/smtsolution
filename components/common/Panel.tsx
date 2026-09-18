import React from "react";

/**
 * - `default`  기존 기본형(p-24 카드).
 * - `compact`  정본 카드 — 제목+부제, 헤더바 없음, 테두리 #dce1e7 / radius 16.
 *              셋업 6개 탭 중 5개가 이 모양이다.
 * - `titlebar` 정본 카드 — 채워진 헤더바(#fbfcfd), 부제 없음, 테두리 line / radius 아래만 14.
 *              **위 모서리가 각진 것은 정본 그대로다**(Figma 노드 `72:69596` 렌더로 확인).
 *              셋업에서는 알림 설정 탭만 이 모양이다. 6개 탭이 한 모양이 아닌 것은
 *              2026-09-18 사용자 결정(정본 그대로 두 스타일).
 */
export type PanelVariant = "default" | "compact" | "titlebar";

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

  if (variant === "titlebar") {
    return (
      <section
        className={`flex flex-col overflow-clip rounded-b-[14px] border border-line bg-white drop-shadow-[0px_1px_1.5px_rgba(23,31,40,0.04)] ${className}`}
      >
        <div className="flex items-center justify-between border-b border-line bg-[#fbfcfd] px-[18px] py-[12px]">
          <h3 className="text-[14px] font-extrabold leading-[normal] text-t1">{title}</h3>
          {action && <div className={`ml-auto ${actionClassName}`}>{action}</div>}
        </div>
        <div className="p-[17px]">{children}</div>
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
