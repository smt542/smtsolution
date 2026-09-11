import type { ReactNode } from "react";

/**
 * 상태/구분 배지(pill)의 공통 껍데기.
 *
 * 불변 클래스(`rounded-[7px] text-xs font-bold`)만 소유하고, display(`inline-flex` 등)·
 * padding·색상 등 나머지는 호출부가 `className`으로 그대로 전달한다.
 * 화면마다 `inline-flex` 유무와 패딩(`px-2.5 py-1` / `px-2 py-1` / `px-3 py-1.5` …)이
 * 달라, 이를 컴포넌트가 강제하면 세로 정렬·간격이 미세하게 바뀐다. "표시 변화 0"을 위해
 * 도메인별 스타일 맵(예: `PAY_STATUS_STYLE[status]`)과 패딩은 호출부에 그대로 둔다.
 *
 * `tone`은 프로토타입 색계열(blue/green/red/amber/gray)의 bg·text 기본색만 제공한다.
 * ⚠️ 색만 제공하며, "정지=red vs 비활성=gray" 같은 의미 매핑은 호출부가 유지한다.
 * `tone` 뒤에 `className`을 붙이므로 호출부가 색을 계속 덮어쓸 수 있고, `tone` 미지정 시
 * 현행과 완전히 동일하다(무회귀).
 */
const TONE = {
  blue: "bg-blue-t text-blue-d",
  green: "bg-green-t text-green",
  red: "bg-red-t text-red",
  amber: "bg-amber-t text-amber",
  gray: "bg-bg text-t3",
} as const;

export function Badge({
  children,
  className = "",
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof TONE;
}) {
  return (
    <span
      className={["rounded-[7px] text-xs font-bold", tone ? TONE[tone] : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
