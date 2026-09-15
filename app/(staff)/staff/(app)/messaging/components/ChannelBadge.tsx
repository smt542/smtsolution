import type { SendMode } from "@/lib/messaging/preset";

/**
 * 메시징 탭 공용 채널 배지. 알림톡은 노랑, 그 외(문자/자동)는 초록으로 표시한다.
 * 예약 발송·발송 내역 탭이 동일한 배지를 공유한다.
 */
export function ChannelBadge({ channel }: { channel: SendMode }) {
  if (channel === "alimtalk") {
    return (
      <span className="inline-flex items-center rounded-[6px] bg-[#fff8e1] px-[8px] py-[3px] text-[12px] font-bold text-[#d97706]">
        알림톡
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[6px] bg-[#e8f5e9] px-[8px] py-[3px] text-[12px] font-bold text-[#2e7d32]">
      문자
    </span>
  );
}
