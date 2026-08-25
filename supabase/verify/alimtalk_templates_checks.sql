-- 각 org에 알림톡 기본 템플릿 7종이 존재하는지 검증
-- 기대: 0행(모든 org가 정확히 7종 보유). 0행이 아니면 프로비저닝 누락 org 존재.
select o.id as org_id,
       count(*) filter (where t.channel_type = 'alimtalk') as alimtalk_templates
from organizations o
left join message_templates t on t.org_id = o.id and t.deleted_at is null
where o.deleted_at is null
group by o.id
having count(*) filter (where t.channel_type = 'alimtalk') <> 7;
