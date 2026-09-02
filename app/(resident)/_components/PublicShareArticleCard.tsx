import type { ReactNode } from "react";

import styles from "./PublicShareArticleCard.module.css";

type PublicShareArticleCardProps = {
  eyebrow: ReactNode;
  title: ReactNode;
  metadata: ReactNode;
  children: ReactNode;
};

export default function PublicShareArticleCard({
  eyebrow,
  title,
  metadata,
  children,
}: PublicShareArticleCardProps) {
  return (
    <article className={styles.card}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.meta}>{metadata}</p>
      {children}
    </article>
  );
}
