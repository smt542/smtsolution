import { Badge } from "@/components/common";
import { messageResultMeta } from "./messageFormat";

interface MessageResultBadgeProps {
  result: string;
  /** 대체문자(SMS/LMS)로 발송된 수신자 수. 있으면 상태 문구에 덧붙인다. */
  altCount?: number;
}

export function MessageResultBadge({ result, altCount = 0 }: MessageResultBadgeProps) {
  const meta = messageResultMeta(result);

  return (
    <Badge
      tone={meta.tone}
      className="inline-flex items-center px-[9px] py-[3px] leading-[16.8px]"
    >
      {altCount > 0 ? `${meta.label} (대체문자 ${altCount})` : meta.label}
    </Badge>
  );
}
