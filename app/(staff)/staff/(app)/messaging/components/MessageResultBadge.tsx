import { Badge } from "@/components/common";
import { messageResultMeta } from "./messageFormat";

interface MessageResultBadgeProps {
  result: string;
}

export function MessageResultBadge({ result }: MessageResultBadgeProps) {
  const meta = messageResultMeta(result);

  return (
    <Badge
      tone={meta.tone}
      className="inline-flex items-center px-[9px] py-[3px] leading-[16.8px]"
    >
      {meta.label}
    </Badge>
  );
}
