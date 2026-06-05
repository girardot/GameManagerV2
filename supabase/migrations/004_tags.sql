-- Tags / genres par jeu

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index tags_user_name_idx on tags (user_id, lower(name));

create table game_tags (
  game_id uuid not null references games(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (game_id, tag_id)
);

create index game_tags_tag_id_idx on game_tags (tag_id);

alter table tags enable row level security;
alter table game_tags enable row level security;

create policy "Users manage own tags"
  on tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own game_tags"
  on game_tags for all
  using (
    exists (
      select 1 from games g
      where g.id = game_tags.game_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from games g
      where g.id = game_tags.game_id and g.user_id = auth.uid()
    )
  );
