import Link from "next/link";

import type {
  PublicBillDetail,
  ResidentBillDetail,
  ResidentBillUtility,
} from "@/hooks/reactquery/residentBilling";
import { formatWon } from "@/lib/format";

import CopyButton from "./CopyButton";
import ResidentStatusChip from "./ResidentStatusChip";
import { billDetailClasses as styles } from "./billDetailClasses";
import { residentButtonClass } from "@/app/(resident)/_components/ResidentButton";

type BillDetailViewProps =
  | { mode: "authed"; detail: ResidentBillDetail }
  | { mode: "public"; detail: PublicBillDetail | null };

type ViewItem = {
  name: string;
  amount: number;
  utility: ResidentBillUtility | null;
  usage: number | null;
  prevUsage: number | null;
};

const UNIT_LABEL: Record<ResidentBillUtility, string> = {
  water: "톤",
  elec: "kWh",
  gas: "㎥",
};

/** "2026년 7월 관리비" — 정본 한글 라벨(lib/format의 dot 포맷과 다름). */
const monthTitle = (period: string) =>
  `${period.slice(0, 4)}년 ${Number(period.slice(5, 7))}월 관리비`;

/** 원 표기에서 접미사만 떼 낸 숫자 문자열(히어로 큰 금액용, 뒤에 <i>원</i>). */
const plainWon = (won: number) => formatWon(won).replace(/원$/, "");

/** 공개 링크 열람 만료 안내용 날짜 "YYYY.MM.DD"(정본 gnote 포맷). */
const formatExpiryDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

/** 개별 사용료 항목의 검침 라벨: "8.2톤 · 전월 7.6톤". 검침 없으면 null. */
const usageLabel = (item: ViewItem): string | null => {
  if (item.utility == null || item.usage == null) return null;
  const unit = UNIT_LABEL[item.utility];
  const current = `${item.usage}${unit}`;
  return item.prevUsage != null
    ? `${current} · 전월 ${item.prevUsage}${unit}`
    : current;
};

function ItemRow({ item }: { item: ViewItem }) {
  const label = usageLabel(item);
  return (
    <div className={styles.it}>
      <div className={styles.nm}>
        {item.name}
        {label ? <small>{label}</small> : null}
      </div>
      <div className={`${styles.vv}${item.amount < 0 ? ` ${styles.r}` : ""}`}>
        {formatWon(item.amount)}
      </div>
    </div>
  );
}

function Subtotal({ label, amount }: { label: string; amount: number }) {
  return (
    <div className={styles.sub}>
      <div className={styles.nm}>{label}</div>
      <div className={styles.vv}>{formatWon(amount)}</div>
    </div>
  );
}

export default function BillDetailView(props: BillDetailViewProps) {
  if (props.mode === "public" && !props.detail) {
    return (
      <div className={styles.state} role="status">
        <b>유효하지 않은 링크</b>
        <span>링크 주소를 다시 확인해 주세요.</span>
      </div>
    );
  }

  if (props.mode === "public" && props.detail?.isExpired) {
    return (
      <div className={styles.state} role="status">
        <b>만료된 링크입니다</b>
        <span>새 공유 링크를 요청해 주세요.</span>
      </div>
    );
  }

  const detail = props.detail;
  if (!detail) return null;

  const items: ViewItem[] = detail.items.map((item) => ({
    name: item.name,
    amount: item.amount,
    utility: item.utility,
    usage: item.usage,
    prevUsage: item.prevUsage,
  }));
  const perItems = items.filter((item) => item.utility != null);
  const comItems = items.filter((item) => item.utility == null);
  const perSum = perItems.reduce((sum, item) => sum + item.amount, 0);
  const comSum = comItems.reduce((sum, item) => sum + item.amount, 0);
  const charge = perSum + comSum;

  const totalAmount = detail.totalAmount ?? 0;
  const unpaidAmount = detail.unpaidAmount ?? 0;
  const lateFee = detail.lateFee ?? 0;
  const grandTotal = totalAmount + lateFee;
  const isDue = unpaidAmount > 0;

  const account =
    detail.mgmtBank && detail.mgmtAcct
      ? `${detail.mgmtBank} ${detail.mgmtAcct}`
      : "";
  // 계좌·금액 복사 = 실제 납부할 금액(미납 원금 + 연체료). 완납 월은 참고용 총액.
  const payableAmount = unpaidAmount > 0 ? unpaidAmount + lateFee : totalAmount;
  const accountWithAmount = account
    ? `${account} ${formatWon(payableAmount)}`
    : "";
  // 공개(무로그인) 링크의 열람 만료일(납기일+1개월). authed 모드에는 없음.
  const publicExpiry =
    props.mode === "public" && props.detail
      ? formatExpiryDate(props.detail.expiresAt)
      : null;

  return (
    <article className={styles.detail}>
      {props.mode === "public" ? (
        <p className={styles.gt}>
          {detail.buildingName} {detail.unitNo} · {monthTitle(detail.period)}
        </p>
      ) : null}

      <section className={styles.hero}>
        <div className={styles.hw}>
          <div className={styles.aline}>
            <b>{account || "계좌 미등록"}</b>
            {detail.mgmtHolder ? <em>{detail.mgmtHolder}</em> : null}
          </div>
          <ResidentStatusChip paid={!isDue} />
        </div>
        <div className={styles.tot}>
          {plainWon(grandTotal)}
          <i>원</i>
        </div>
        {account ? (
          <div className={styles.acct}>
            <div className={styles.abtns}>
              <CopyButton
                text={account}
                label="계좌 복사"
                toastMessage="계좌번호를 복사했어요"
                toastOffset="billDetail"
                className={residentButtonClass({ size: "sm", variant: "primaryTint", className: "flex-1 disabled:cursor-default disabled:opacity-55" })}
              />
              <CopyButton
                text={accountWithAmount}
                label="계좌·금액 복사"
                toastMessage="계좌번호와 금액을 복사했어요"
                toastOffset="billDetail"
                className={residentButtonClass({ size: "sm", variant: "primary", className: "flex-1 disabled:cursor-default disabled:opacity-55" })}
              />
            </div>
          </div>
        ) : null}
      </section>

      {perItems.length > 0 ? (
        <>
          <div className={styles.lbl}>
            개별 사용료<span>{perItems.length}개</span>
          </div>
          <section className={styles.card} aria-label="개별 사용료">
            {perItems.map((item, index) => (
              <ItemRow key={`per-${item.name}-${index}`} item={item} />
            ))}
            <Subtotal label="개별 사용료 소계" amount={perSum} />
          </section>
        </>
      ) : null}

      {comItems.length > 0 ? (
        <>
          <div className={styles.lbl}>
            공용 · 기타 관리비<span>{comItems.length}개</span>
          </div>
          <section className={styles.card} aria-label="공용 · 기타 관리비">
            {comItems.map((item, index) => (
              <ItemRow key={`com-${item.name}-${index}`} item={item} />
            ))}
            <Subtotal label="공용 · 기타 소계" amount={comSum} />
          </section>
        </>
      ) : null}

      <div className={styles.lbl}>정산</div>
      <section className={styles.fin} aria-label="정산">
        <div className={styles.it}>
          <div className={styles.nm}>당월 부과액</div>
          <div className={styles.vv}>{formatWon(charge)}</div>
        </div>
        <div className={styles.it}>
          <div className={styles.nm}>미납액</div>
          <div className={styles.vv}>{formatWon(unpaidAmount)}</div>
        </div>
        <div className={styles.it}>
          <div className={styles.nm}>연체료</div>
          <div className={styles.vv}>{formatWon(lateFee)}</div>
        </div>
        <div className={styles.grand}>
          <div className={styles.nm}>총 관리비</div>
          <div className={styles.vv}>{formatWon(grandTotal)}</div>
        </div>
      </section>

      {props.mode === "public" ? (
        <>
          <div className={styles.cta}>
            <b>지난 달 내역도 앱에서 확인하세요</b>
            <span>월별 부과 내역과 공지를 카카오 로그인 한 번으로 볼 수 있어요.</span>
            <Link href="/resident/login">관리비서 시작하기</Link>
          </div>
          {publicExpiry ? (
            <p className={styles.gnote}>
              이 링크는 관리비 확인 전용이며 {publicExpiry}까지 열람할 수 있습니다.
            </p>
          ) : null}
        </>
      ) : null}
    </article>
  );
}
