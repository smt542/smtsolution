import type { ReactNode } from "react";

/**
 * 상태/구분 배지(pill)의 공통 껍데기.
 *
 * 불변 클래스(`rounded-full text-xs font-bold`)만 소유하고, display(`inline-flex` 등)·
 * padding·색상 등 나머지는 호출부가 `className`으로 그대로 전달한다.
 * 화면마다 `inline-flex` 유무와 패딩(`px-2.5 py-1` / `px-2 py-1` / `px-3 py-1.5` …)이
 * 달라, 이를 컴포넌트가 강제하면 세로 정렬·간격이 미세하게 바뀐다. "표시 변화 0"을 위해
 * 도메인별 스타일 맵(예: `PAY_STATUS_STYLE[status]`)과 패딩은 호출부에 그대로 둔다.
 */
export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={["rounded-[7px] text-xs font-bold", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
