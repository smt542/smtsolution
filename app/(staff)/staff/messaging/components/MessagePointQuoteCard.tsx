import type { MessagePointQuote } from "@/hooks/reactquery/messaging";

interface MessagePointQuoteCardProps {
  quote?: MessagePointQuote;
  isLoading?: boolean;
  error?: unknown;
}
const numberFormat = new Intl.NumberFormat("ko-KR");
const points = (value: number) => `${numberFormat.format(value)} P`;

export function MessagePointQuoteCard({
  quote,
  isLoading = false,
  error,
}: MessagePointQuoteCardProps) {
  if (isLoading) {
    return (
      <section className="rounded-xl border border-line bg-bg/60 p-4" aria-live="polite">
        <p className="text-sm font-bold text-t2">포인트 견적을 계산하는 중입니다…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-xl border border-danger/30 bg-danger/10 p-4" role="alert">
        <p className="text-sm font-extrabold text-danger">포인트 견적을 불러오지 못했습니다.</p>
        <p className="mt-1 text-xs text-danger/90">
          {error instanceof Error ? error.message : "수신처와 단가 설정을 확인해 주세요."}
        </p>
      </section>
    );
  }

  if (!quote) {
    return (
      <section className="rounded-xl border border-line bg-bg/60 p-4">
        <p className="text-sm text-t3">수신처를 선택하면 예상 포인트가 표시됩니다.</p>
      </section>
    );
  }

  const afterBalance = quote.availablePoints - quote.estimatedPoints;
  const liveInsufficient = quote.billingMode === "live" && !quote.sufficient;

  return (
    <section
      aria-label="메시지 포인트 견적"
      className={`rounded-xl border p-4 ${
        liveInsufficient
          ? "border-danger/30 bg-danger/10"
          : "border-line bg-bg/60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-t1">포인트 견적</h4>
          <p className="mt-1 text-xs text-t3">
            SMS {quote.channelCounts.sms}건 × {points(quote.rateSnapshot.sms.points)}
            {quote.channelCounts.lms > 0 && (
              <> · LMS {quote.channelCounts.lms}건 × {points(quote.rateSnapshot.lms.points)}</>
            )}
            {" · "}알림톡 {quote.channelCounts.alimtalk}건 × {points(quote.rateSnapshot.alimtalk.points)}
          </p>
        </div>
        <strong className="text-lg text-t1">예상 {points(quote.estimatedPoints)}</strong>
      </div>

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
        <PointValue label="원장 잔액" value={quote.ledgerBalance} />
        <PointValue label="예약" value={quote.reservedPoints} />
        <PointValue label="가용 잔액" value={quote.availablePoints} />
        <PointValue label="예상 발송 후" value={afterBalance} danger={liveInsufficient} />
      </dl>

      {quote.excludedCount > 0 && (
        <p className="mt-3 text-xs font-semibold text-amber">
          중복·연락처 없음·알림톡 미동의 수신처 {quote.excludedCount}명은 제외됩니다.
        </p>
      )}

      {quote.billingMode === "stub" ? (
        <p className="mt-3 rounded-lg bg-brand/10 px-3 py-2 text-xs font-extrabold text-brand">
          테스트 발송 — 실제 전송 및 포인트 차감 없음
        </p>
      ) : liveInsufficient ? (
        <p className="mt-3 text-xs font-extrabold text-danger">
          가용 포인트가 부족합니다. {points(quote.estimatedPoints)}가 필요합니다.
        </p>
      ) : null}
    </section>
  );
}

function PointValue({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface px-3 py-2">
      <dt className="text-t3">{label}</dt>
      <dd className={`mt-0.5 font-extrabold ${danger ? "text-danger" : "text-t1"}`}>
        {points(value)}
      </dd>
    </div>
  );
}
