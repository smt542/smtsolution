import styles from "./_shell.module.css";

export default function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <div className={styles.screen}>{children}</div>
    </div>
  );
}
