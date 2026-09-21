# 예약 메시지 EventBridge 운영 가이드

## 개요

예약 메시지 worker는 다음 서버 라우트를 호출할 때 만기 예약분을 최대 50건씩 처리한다.

~~~text
POST https://<amplify-domain>/api/messaging/dispatch-scheduled
Authorization: Bearer <CRON_SECRET>
~~~

권장 배선은 **EventBridge Rule(rate(1 minute)) → API destination**이다. Connection이 Authorization 헤더를 보관하므로 Lambda가 필요 없다. API destination은 공개 HTTPS 엔드포인트가 5초 안에 응답해야 하므로, 실제 처리 시간이 이를 넘는 환경에서는 아래의 **EventBridge Scheduler → Lambda** 대안을 사용한다.

실제 AWS 리소스 생성은 이 저장소 작업에 포함되지 않는다. 반드시 클라이언트 SSO 계정 **auraworks**에 로그인한 뒤 같은 리전에서 수행한다.

## 1. CRON_SECRET 설정

CRON_SECRET은 서버 전용 비밀값이다. 이름에 NEXT_PUBLIC_ 접두사를 붙이지 않는다. 브라우저 코드나 저장소에 값을 커밋하지 않는다.

강한 난수 한 개를 생성하고 로컬, Amplify, EventBridge Connection 또는 Lambda에 모두 같은 값으로 등록한다.

~~~bash
openssl rand -hex 32
~~~

### 로컬

저장소 루트의 .env.local에 다음을 추가한다.

~~~dotenv
CRON_SECRET=<생성한-64자리-hex>
~~~

.env.local은 커밋하지 않는다. 개발 서버가 실행 중이었다면 환경변수를 읽도록 다시 시작한다.

### Amplify

1. AWS 콘솔에서 **Amplify → 해당 앱 → Hosting → Environment variables**로 이동한다.
2. CRON_SECRET을 추가하고 생성한 비밀값을 입력한다.
3. 적용 대상 브랜치를 확인한다.
4. 환경변수가 서버 런타임에 반영되도록 해당 브랜치를 다시 배포한다.

NEXT_PUBLIC_CRON_SECRET 같은 공개 변수는 만들지 않는다.

## 2. 배선 A — EventBridge Rule + API destination (권장, Lambda 없음)

아래 예시는 Bash와 AWS CLI v2 기준이다. auraworks가 로컬 AWS SSO 프로필 이름과 다르면 --profile 값을 실제 프로필 이름으로 바꾼다.

~~~bash
aws sso login --profile auraworks

export AWS_PROFILE=auraworks
export AWS_REGION=ap-northeast-2
export DISPATCH_URL="https://<amplify-domain>/api/messaging/dispatch-scheduled"
export CRON_SECRET="<Amplify에 등록한 값>"
export CONNECTION_NAME="home-erp-scheduled-messaging"
export DESTINATION_NAME="home-erp-scheduled-messaging"
export RULE_NAME="home-erp-scheduled-messaging-every-minute"
export ROLE_NAME="home-erp-eventbridge-api-destination"
~~~

### 2.1 Connection 생성

API key 인증의 키 이름을 Authorization, 값은 Bearer와 비밀값을 합친 문자열로 설정한다.

~~~bash
AUTH_PARAMETERS=$(printf '{"ApiKeyAuthParameters":{"ApiKeyName":"Authorization","ApiKeyValue":"Bearer %s"}}' "$CRON_SECRET")

CONNECTION_ARN=$(aws events create-connection \
  --name "$CONNECTION_NAME" \
  --authorization-type API_KEY \
  --auth-parameters "$AUTH_PARAMETERS" \
  --query ConnectionArn \
  --output text)

aws events describe-connection \
  --name "$CONNECTION_NAME" \
  --query '{State:ConnectionState,Reason:StateReason,Arn:ConnectionArn}'
~~~

ConnectionState가 AUTHORIZED가 된 뒤 다음 단계로 진행한다. EventBridge는 Connection 자격 증명을 AWS Secrets Manager의 서비스 관리형 secret에 저장한다. secret 값을 CLI 출력이나 운영 문서에 남기지 않는다.

### 2.2 API destination 생성

~~~bash
DESTINATION_ARN=$(aws events create-api-destination \
  --name "$DESTINATION_NAME" \
  --connection-arn "$CONNECTION_ARN" \
  --invocation-endpoint "$DISPATCH_URL" \
  --http-method POST \
  --invocation-rate-limit-per-second 1 \
  --query ApiDestinationArn \
  --output text)
~~~

### 2.3 대상 호출용 최소 IAM role

EventBridge Rule이 assume할 role의 신뢰 정책:

~~~json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "events.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
~~~

권한 정책은 해당 API destination 한 개로 제한한다.

~~~json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "events:InvokeApiDestination",
      "Resource": "<DESTINATION_ARN>"
    }
  ]
}
~~~

위 JSON을 각각 eventbridge-trust.json, eventbridge-api-destination-policy.json으로 저장한 경우:

~~~bash
aws iam create-role \
  --role-name "$ROLE_NAME" \
  --assume-role-policy-document file://eventbridge-trust.json

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name InvokeScheduledMessagingApiDestination \
  --policy-document file://eventbridge-api-destination-policy.json

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ROLE_ARN="arn:aws:iam::$ACCOUNT_ID:role/$ROLE_NAME"
~~~

실행자가 이 role을 EventBridge에 연결하려면 iam:PassRole도 필요하다.

### 2.4 1분 Rule과 target 연결

~~~bash
aws events put-rule \
  --name "$RULE_NAME" \
  --schedule-expression "rate(1 minute)" \
  --state ENABLED \
  --description "Drain due home_erp scheduled messages"

aws events put-targets \
  --rule "$RULE_NAME" \
  --targets "Id=scheduled-messaging,Arn=$DESTINATION_ARN,RoleArn=$ROLE_ARN"

aws events list-targets-by-rule --rule "$RULE_NAME"
~~~

라우트는 요청 본문을 사용하지 않으므로 EventBridge 기본 이벤트 본문이 전달되어도 무방하다.

### 2.5 콘솔 배선

1. auraworks SSO 계정과 사용할 리전을 확인한다.
2. **Amazon EventBridge → API destinations → Connections → Create connection**으로 이동한다.
3. 인증 유형을 **API key**로 선택하고 key에 Authorization, value에 Bearer <CRON_SECRET>을 입력한다.
4. Connection 상태가 **Authorized**인지 확인한다.
5. **API destinations → Create API destination**에서 엔드포인트를 Amplify 라우트 URL, 메서드를 POST, 초당 호출 제한을 1로 지정하고 위 Connection을 선택한다.
6. **Rules → Create rule → Schedule**에서 rate(1 minute)을 선택한다.
7. target 유형으로 **EventBridge API destination**을 선택하고 생성한 destination을 지정한다.
8. 새 실행 role을 만들거나 events:InvokeApiDestination이 해당 destination ARN에만 허용된 기존 role을 선택한다.
9. Rule이 Enabled인지 확인한다.

## 3. 배선 B — EventBridge Scheduler → 최소 Lambda (대안)

API destination의 5초 응답 제한을 넘거나 Lambda에서 타임아웃, 재시도, secret 조회를 더 세밀하게 제어해야 할 때 사용한다.

### 3.1 Lambda 코드 스텁

Node.js 22.x 런타임 예시다. Lambda 환경변수 DISPATCH_URL과 CRON_SECRET에 각각 Amplify 라우트 URL과 동일한 비밀값을 등록한다. 둘 다 공개 변수가 아니며 Lambda 환경변수 암호화를 사용한다.

~~~js
export const handler = async () => {
  const url = process.env.DISPATCH_URL;
  const secret = process.env.CRON_SECRET;

  if (!url || !secret) {
    throw new Error("DISPATCH_URL 또는 CRON_SECRET이 설정되지 않았습니다.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: "Bearer " + secret,
    },
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error("예약 메시지 처리 실패: HTTP " + response.status + " " + body);
  }

  console.log("예약 메시지 처리 결과", body);
  return { statusCode: response.status, body };
};
~~~

Lambda 실행 role에는 기본 CloudWatch Logs 쓰기 권한만 필요하다. CRON_SECRET을 Lambda 환경변수 대신 별도 Secrets Manager secret에서 읽는 경우 그 secret ARN에 대한 secretsmanager:GetSecretValue를 추가한다.

### 3.2 Scheduler 실행 role과 schedule

Scheduler가 assume하는 role의 신뢰 주체는 scheduler.amazonaws.com이며, 권한은 대상 함수 한 개의 lambda:InvokeFunction으로 제한한다.

~~~json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "scheduler.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
~~~

~~~json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "<FUNCTION_ARN>"
    }
  ]
}
~~~

scheduler-target.json의 placeholder를 실제 ARN으로 교체한다.

~~~json
{
  "Arn": "<FUNCTION_ARN>",
  "RoleArn": "<SCHEDULER_ROLE_ARN>",
  "Input": "{}"
}
~~~

~~~bash
aws scheduler create-schedule \
  --name home-erp-scheduled-messaging-every-minute \
  --schedule-expression "rate(1 minute)" \
  --flexible-time-window '{"Mode":"OFF"}' \
  --state ENABLED \
  --target file://scheduler-target.json \
  --profile auraworks \
  --region ap-northeast-2
~~~

콘솔에서는 **Amazon EventBridge → Scheduler → Create schedule**에서 recurring schedule과 rate(1 minute)을 선택하고, flexible time window를 Off로 둔 뒤 Lambda 함수를 target으로 지정한다. 콘솔이 새 실행 role을 만들게 하거나 위 최소 권한 role을 선택한다.

## 4. IAM 및 secret 최소화 원칙

- 배선 A의 Rule role: 대상 destination ARN에 대한 events:InvokeApiDestination만 허용한다.
- 배선 A의 Connection secret: EventBridge가 Secrets Manager에 만들고 서비스 연결 role로 관리한다. 애플리케이션 role에 읽기 권한을 추가하지 않는다.
- 배선 B의 Scheduler role: 대상 함수 ARN에 대한 lambda:InvokeFunction만 허용한다.
- 배선 B의 Lambda role: CloudWatch Logs 권한과, 사용하는 경우 특정 secret ARN의 secretsmanager:GetSecretValue만 허용한다.
- 배선을 만드는 운영자에게는 필요한 events, scheduler, iam:PassRole 권한만 기간과 리소스를 제한해 부여한다.
- CRON_SECRET은 로그, 티켓, 스크린샷, 명령 이력에 남기지 말고 노출이 의심되면 Amplify와 Connection 또는 Lambda 값을 함께 교체한다.

## 5. 검증

검증은 실제 만기 예약행의 상태를 sent 또는 failed로 마감한다. 테스트용 조직과 예약 건으로 먼저 수행한다.

### 5.1 curl로 cron 인증 확인

~~~bash
curl --fail-with-body --silent --show-error \
  -X POST \
  -H "authorization: Bearer $CRON_SECRET" \
  "$DISPATCH_URL"
~~~

정상 응답 예(예약분은 Popbill에 **접수**만 하고 결과는 재조회로 확정한다):

~~~json
{
  "claimed": 3,
  "queued": 2,
  "failed": 1,
  "unconfigured": 0,
  "finalized": 0
}
~~~

잘못된 secret으로 호출했을 때 성공하면 안 된다.

### 5.2 staff 화면에서 세션 인증 확인

1. messaging 권한이 있는 staff로 /staff/messaging에 로그인한다.
2. **예약분 지금 처리**를 누른다.
3. 처리 N · 발송 N · 실패 N · 미설정 N 형식의 토스트를 확인한다.
4. 이 호출에는 CRON_SECRET 헤더가 없으며 로그인 세션의 조직 예약분만 처리되어야 한다.
5. messaging 권한이 없는 계정은 권한 오류가 나야 한다.

### 5.3 EventBridge와 CloudWatch 확인

배선 A:

1. EventBridge Rule의 **Monitoring** 탭 또는 CloudWatch의 AWS/Events 지표에서 Invocations와 FailedInvocations를 확인한다.
2. API destination과 Connection 상태가 Active 또는 Authorized인지 확인한다.
3. 실패가 있으면 target role의 events:InvokeApiDestination, Amplify URL, CRON_SECRET 일치 여부와 5초 응답 제한을 확인한다.
4. EventBridge Rule은 응답 본문을 CloudWatch Logs에 자동 기록하지 않는다. 응답/서버 오류는 Amplify 애플리케이션 로그에서 확인하고, 전달 실패 보존이 필요하면 Rule target에 SQS DLQ를 추가한다.

배선 B:

1. Scheduler의 Last invocation과 target 오류 지표를 확인한다.
2. CloudWatch Logs의 /aws/lambda/<함수명> 로그 그룹에서 예약 메시지 처리 결과 JSON을 확인한다.
3. Scheduler role의 lambda:InvokeFunction과 Lambda의 타임아웃 설정을 확인한다.

마지막으로 최소 2~3분 동안 1분 간격 호출이 이어지는지 확인하고, 같은 예약이 중복 발송되지 않는지 메시지 이력과 포인트 정산 결과를 점검한다.

## 6. 운영 주의사항

- 실 배선과 변경은 반드시 클라이언트 SSO 계정 **auraworks**에서 수행한다.
- Popbill 필수 설정(`POPBILL_*`)이나 해당 제품 발신번호가 없으면 예약분은 접수되지 않고 failed로 마감되며 집계의 unconfigured에 포함된다.
- 한 번의 호출은 최대 50건을 claim한다. backlog가 있으면 다음 1분 tick이 이어서 처리한다.
- CRON_SECRET을 교체할 때는 Amplify와 EventBridge Connection 또는 Lambda 값을 모두 바꾸고 재배포/재승인을 확인한다.
- API destination은 공개 HTTPS와 공개적으로 신뢰되는 인증서가 필요하며 응답 제한은 5초다. 이 제한을 안정적으로 지키기 어렵다면 배선 B를 선택한다.

## 7. 결과 재조회(Popbill 폴링)

Popbill 접수 후 최종 결과(state=3/result=100)를 확정하려면 결과 재조회 라우트를 **동일한 CRON_SECRET**으로 주기 호출한다.

~~~text
POST https://<amplify-domain>/api/delivery/reconcile
Authorization: Bearer <CRON_SECRET>
~~~

- 배선은 예약 발송과 동일하다(배선 A: EventBridge Rule + API destination, 또는 배선 B: Scheduler + Lambda). 같은 Connection/Secret을 재사용하고 별도 Rule/schedule을 추가한다.
- 권장 주기: **rate(1 minute)**. 라우트 내부 backoff(최초 10분 1분·2시간까지 5분·24시간까지 30분)가 실제 조회 간격을 조절하므로 1분 tick으로 충분하다.
- 정상 응답: `{ "processed": N, "pending": N, "finalized": N, "reconcileRequired": N }`.
- 응답에는 집계만 담기며 수신자 개인정보·공급자 원본 응답은 포함하지 않는다.

### 경보 기준

- **reconcileRequired 증가**: 24시간 내 확정되지 않은 작업. Popbill 콘솔에서 실제 상태를 대조하고 포인트 예약(reconcile_required)을 수동 검토한다(만료만으로 해제 금지).
- **pending 정체**: 특정 작업이 오래 pending이면 발신번호/템플릿 승인·잔액을 점검한다.
- **Popbill 잔액 부족**: 파트너/연동회원 잔액을 주기 모니터링(부족 시 접수 실패).
- 상세 운영 절차는 `docs/ops/popbill-delivery.md` 참고.

## 감사 로그 보존 purge (배선 완료됨)

예약 발송과 **같은 Connection을 재사용**한다. 따라서 CRON_SECRET을 새로 만들 필요가 없다.

2026-09-21 기준 계정 `256056996318`(ap-northeast-2)에 아래가 생성돼 있다. 기존 예약 발송
리소스는 변경하지 않았다 — 역할이 destination ARN 단위로 한정돼 있어 전용 역할을 따로 뒀다.

| 리소스 | 이름 |
|---|---|
| Rule | `home-erp-access-log-purge-daily` · `cron(0 18 * * ? *)` (18:00 UTC = **03:00 KST**) · ENABLED |
| API destination | `home-erp-access-log-purge` → `POST /api/cron/purge-access-log` · 1 req/s |
| Connection | `home-erp-scheduled-messaging` (재사용) |
| IAM role | `home-erp-eventbridge-access-log-purge` (해당 destination만 invoke) |

라우트는 인수를 넘기지 않는다. 보존기간은 DB 함수 `purge_access_log(p_retention_days default 730)`
기본값 한 곳에만 있으므로 **기간 변경은 마이그레이션만으로 끝나고 코드 배포·배선 수정이 필요 없다.**
365일 미만을 넘기면 함수가 예외를 던진다(법정 최소치 방어).

정상 응답: `{ "deleted": N }`. 인증 실패는 401이며, 감사기록 삭제라 세션 폴백이 없다(CRON_SECRET 전용).

### 동작 확인

~~~bash
export AWS_PROFILE=home-erp AWS_REGION=ap-northeast-2
SECRET=$(aws amplify get-branch --app-id d1bbgt7v44nxj3 --branch-name master   --query 'branch.environmentVariables.CRON_SECRET' --output text)
curl -s -X POST -H "Authorization: Bearer $SECRET"   https://master.d1bbgt7v44nxj3.amplifyapp.com/api/cron/purge-access-log
unset SECRET
~~~

## 참고

- [EventBridge API destinations](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-api-destinations.html)
- [AWS CLI create-connection](https://docs.aws.amazon.com/cli/latest/reference/events/create-connection.html)
- [AWS CLI create-api-destination](https://docs.aws.amazon.com/cli/latest/reference/events/create-api-destination.html)
- [API destination target IAM role](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-events-iam-roles.html)
- [EventBridge Scheduler로 Lambda 호출](https://docs.aws.amazon.com/lambda/latest/dg/with-eventbridge-scheduler.html)
