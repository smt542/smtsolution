import type { ReactNode } from "react";

import styles from "./ResidentScreenFrame.module.css";

type ResidentScreenFrameProps = {
  variant: "public" | "legal";
  header: ReactNode;
  children: ReactNode;
};

const variantStyles = {
  public: {
    page: styles.publicPage,
    header: styles.publicHeader,
    content: styles.publicContent,
  },
  legal: {
    page: styles.legalPage,
    header: styles.legalHeader,
    content: styles.legalContent,
  },
} as const;

export default function ResidentScreenFrame({
  variant,
  header,
  children,
}: ResidentScreenFrameProps) {
  const variantStyle = variantStyles[variant];

  return (
    <div className={variantStyle.page}>
      <header className={variantStyle.header}>{header}</header>
      <main className={variantStyle.content}>{children}</main>
    </div>
  );
}
