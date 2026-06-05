-- Add priority ordering to buy_list (1 = highest priority)

alter table buy_list
  add column if not exists priority integer not null default 1;

with ranked as (
  select
    id,
    row_number() over (partition by user_id order by created_at) as rn
  from buy_list
)
update buy_list b
set priority = r.rn
from ranked r
where b.id = r.id;

create index if not exists buy_list_user_priority_idx
  on buy_list (user_id, priority);
