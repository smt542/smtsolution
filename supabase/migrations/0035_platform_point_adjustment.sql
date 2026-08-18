-- 0035_platform_point_adjustment.sql
-- 통합관리자 포인트 조정(P3): 운영자 수동 정정·차감·환불 원장 타입 추가.
-- 의존: 0011(point_tx_type, point_transactions, pt_platform).

alter type point_tx_type add value if not exists 'adjustment';
