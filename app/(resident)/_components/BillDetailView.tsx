import type {
  PublicBillDetail,
  ResidentBillDetail,
  ResidentBillUtility,
} from "@/hooks/reactquery/residentBilling";
import { formatWon } from "@/lib/format";

import CopyButton from "./CopyButton";
import ResidentGuestCta from "./ResidentGuestCta";
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
      <div className={styles.subNm}>{label}</div>
      <div className={styles.subVv}>{formatWon(amount)}</div>
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
  // 항목이 비어도 섹션을 숨기지 않는다(빈 화면은 오류처럼 보인다). 개별 사용료가 하나도 없으면 0원 행으로 채운다.
  const utilityItems = items.filter((item) => item.utility != null);
  const perItems: ViewItem[] =
    utilityItems.length > 0
      ? utilityItems
      : [
          { name: "수도료", amount: 0, utility: null, usage: null, prevUsage: null },
          { name: "전기료", amount: 0, utility: null, usage: null, prevUsage: null },
          { name: "가스료", amount: 0, utility: null, usage: null, prevUsage: null },
        ];
  const comItems = items.filter((item) => item.utility == null);
  const perSum = perItems.reduce((sum, item) => sum + item.amount, 0);
  const comSum = comItems.reduce((sum, item) => sum + item.amount, 0);
  const charge = perSum + comSum;

  const totalAmount = detail.totalAmount ?? 0;
  // 당월 미수납 원금(납부 상태·납부할 금액 판정용).
  const unpaidAmount = detail.unpaidAmount ?? 0;
  // 정산의 미납액 = 전월까지 이월된 미납. 연체료 = 이월분 연체료 + 당월분 연체료(정책: 세입자_관리비 상세고지서 3.4).
  const carryoverUnpaid = detail.carryoverUnpaid ?? 0;
  const lateFee = (detail.carryoverLateFee ?? 0) + (detail.lateFee ?? 0);
  // 총 관리비 = 당월 부과액 + 미납액(이월) + 연체료
  const grandTotal = totalAmount + carryoverUnpaid + lateFee;
  const outstanding = unpaidAmount + carryoverUnpaid;
  const isDue = outstanding > 0;

  const account =
    detail.mgmtBank && detail.mgmtAcct
      ? `${detail.mgmtBank} ${detail.mgmtAcct}`
      : "";
  // 계좌·금액 복사 = 실제 납부할 금액(당월 미납 + 이월 미납 + 연체료). 완납이면 참고용 당월 부과액.
  const payableAmount = isDue ? outstanding + lateFee : totalAmount;
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
        <h1 className={styles.gt}>
          {detail.buildingName} {detail.unitNo} · {monthTitle(detail.period)}
        </h1>
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

      <div className={styles.lbl}>
        개별 사용료<span>{perItems.length}개</span>
      </div>
      <section className={styles.card} aria-label="개별 사용료">
        {perItems.map((item, index) => (
          <ItemRow key={`per-${item.name}-${index}`} item={item} />
        ))}
        <Subtotal label="개별 사용료 소계" amount={perSum} />
      </section>

      <div className={styles.lbl}>
        공용 · 기타 관리비<span>{comItems.length}개</span>
      </div>
      <section className={styles.card} aria-label="공용 · 기타 관리비">
        {comItems.map((item, index) => (
          <ItemRow key={`com-${item.name}-${index}`} item={item} />
        ))}
        <Subtotal label="공용 · 기타 소계" amount={comSum} />
      </section>

      <div className={styles.lbl}>정산</div>
      <section className={styles.fin} aria-label="정산">
        <div className={styles.it}>
          <div className={styles.finNm}>당월 부과액</div>
          <div className={styles.vv}>{formatWon(charge)}</div>
        </div>
        <div className={styles.it}>
          <div className={styles.finNm}>미납액</div>
          <div className={styles.vv}>{formatWon(carryoverUnpaid)}</div>
        </div>
        <div className={styles.it}>
          <div className={styles.finNm}>연체료</div>
          <div className={styles.vv}>{formatWon(lateFee)}</div>
        </div>
        <div className={styles.grand}>
          <div className={styles.grandNm}>총 관리비</div>
          <div className={styles.grandVv}>{formatWon(grandTotal)}</div>
        </div>
      </section>

      {props.mode === "public" ? (
        <>
          <ResidentGuestCta
            className="mt-[18px]"
            title="지난 달 내역도 앱에서 확인하세요"
            description="월별 부과 내역과 공지를 카카오 로그인 한 번으로 볼 수 있어요."
          />
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
