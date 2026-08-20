import styles from "./_placeholder.module.css";

export function PartnerPlaceholder({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.title}>{title}</div>
      <div className={styles.msg}>{desc ?? "준비 중이에요"}</div>
    </div>
  );
}
