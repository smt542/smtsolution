import styles from "./PartnerInlineError.module.css";

type PartnerInlineErrorProps = {
  /** Error text to show. Render this component only when there is a message — the caller keeps its own truthy check. */
  message: string;
};

/** `role="alert"` banner for inline form/save errors. */
export function PartnerInlineError({ message }: PartnerInlineErrorProps) {
  return (
    <div className={styles.err} role="alert">
      {message}
    </div>
  );
}
