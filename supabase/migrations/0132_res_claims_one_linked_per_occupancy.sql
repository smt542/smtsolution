-- 0132_res_claims_one_linked_per_occupancy.sql
-- 보안(세대 계정 탈취 심층방어): 한 세대(occupancy)를 둘 이상의 카카오 계정이 동시에 'linked'로
-- 점유하지 못하도록 부분 유니크 인덱스를 추가한다. resident_confirm의 자동 링크가 전화 일치만으로
-- 이뤄지므로(실 플로우에서 전화는 카카오 검증값), 최소한 한 세대의 중복 링크를 DB 레벨에서 차단한다.
-- 기존 유니크는 resident_user_id 방향(한 세입자당 linked 1건)만 보장했다.
-- 참고: 자동매칭을 이름 일치/스태프 승인으로 게이팅할지는 제품 결정 사항(카카오 닉네임≠실명 이슈)이라 별도.

create unique index if not exists res_claims_one_linked_per_occupancy
  on res_claims (occupancy_id)
  where status = 'linked';
