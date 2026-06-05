-- Game Manager schema

create type game_progress as enum ('todo', 'in_progress', 'done', 'abandoned');

create table consoles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  console_id uuid not null references consoles(id) on delete cascade,
  title text not null,
  is_digital boolean not null default false,
  progress game_progress not null default 'todo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, console_id, title)
);

create table play_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  console_id uuid references consoles(id) on delete set null,
  game_id uuid references games(id) on delete set null,
  priority integer not null default 1,
  notes text,
  created_at timestamptz not null default now()
);

create table buy_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  console_id uuid references consoles(id) on delete set null,
  is_digital boolean,
  price numeric(10, 2),
  notes text,
  created_at timestamptz not null default now()
);

create index games_user_id_idx on games (user_id);
create index games_console_id_idx on games (console_id);
create index play_queue_user_priority_idx on play_queue (user_id, priority);
create index buy_list_user_id_idx on buy_list (user_id);

alter table consoles enable row level security;
alter table games enable row level security;
alter table play_queue enable row level security;
alter table buy_list enable row level security;

create policy "Users manage own consoles"
  on consoles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own games"
  on games for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own play_queue"
  on play_queue for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own buy_list"
  on buy_list for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function update_games_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger games_updated_at
  before update on games
  for each row execute function update_games_updated_at();
