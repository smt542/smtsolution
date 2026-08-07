import React from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const base = "h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-70";
  const v = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    ghost: "bg-white text-t2 border border-line hover:bg-bg",
    danger: "bg-danger text-white",
  }[variant];
  return <button className={`${base} ${v} ${className}`} {...props} />;
}
