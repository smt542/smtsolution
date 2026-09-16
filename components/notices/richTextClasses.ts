/** Shared Tailwind utilities for the editable and read-only notice renderers. */
export const noticeRichTextClassName = [
  "text-[inherit] leading-[1.7] break-words [overflow-wrap:anywhere]",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:m-0 [&_p]:mb-[0.75em]",
  "[&_h2]:my-[1.2em] [&_h2]:mb-[0.5em] [&_h2]:text-[1.15em] [&_h2]:font-extrabold",
  "[&_h3]:my-[1em] [&_h3]:mb-[0.4em] [&_h3]:text-[1.05em] [&_h3]:font-bold",
  "[&_ul]:m-0 [&_ul]:mb-[0.75em] [&_ul]:list-disc [&_ul]:pl-[1.4em]",
  "[&_ol]:m-0 [&_ol]:mb-[0.75em] [&_ol]:list-decimal [&_ol]:pl-[1.4em]",
  "[&_li]:my-[0.2em] [&_li>p]:m-0",
  "[&_blockquote]:m-0 [&_blockquote]:mb-[0.75em] [&_blockquote]:border-l-[3px] [&_blockquote]:border-line [&_blockquote]:py-[0.4em] [&_blockquote]:pl-[0.9em] [&_blockquote]:text-t2",
  "[&_a]:break-all [&_a]:text-blue-d [&_a]:underline",
  "[&_strong]:font-bold [&_em]:italic",
].join(" ");

export const noticeImageClassName = "my-[0.5em] block h-auto max-w-full rounded-lg";

export const noticeImageStateClassName = [
  "my-[0.5em] flex min-h-[120px] items-center justify-center rounded-lg",
  "border border-dashed border-line bg-bg px-3 text-center text-xs text-t3",
].join(" ");
