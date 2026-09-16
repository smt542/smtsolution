type PartnerInlineErrorProps = {
  /** Error text to show. Render this component only when there is a message — the caller keeps its own truthy check. */
  message: string;
};

/** `role="alert"` banner for inline form/save errors. */
export function PartnerInlineError({ message }: PartnerInlineErrorProps) {
  return (
    <div className="mt-2 rounded-btn bg-red-t px-3 py-2.5 text-[13px] font-semibold text-red" role="alert">
      {message}
    </div>
  );
}
