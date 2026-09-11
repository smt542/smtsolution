import React from "react";

/**
 * 아이콘 전용 버튼 래퍼. 정사각형 크기·모서리·hover 배경은 호출부가 className으로 지정하고,
 * 여기서는 공통 불변식(가운데 정렬 flex·type=button 기본·aria-label 필수)만 강제한다.
 */
type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  "aria-label": string;
};

export function IconButton({ className = "", type = "button", ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={`flex items-center justify-center ${className}`}
      {...props}
    />
  );
}
