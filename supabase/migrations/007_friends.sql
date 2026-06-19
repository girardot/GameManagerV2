-- Profiles and friendships

create type friendship_status as enum ('pending', 'accepted', 'rejected');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create unique index profiles_email_lower_idx on profiles (lower(email));

create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index friendships_addressee_status_idx
  on friendships (addressee_id, status);
create index friendships_requester_status_idx
  on friendships (requester_id, status);

alter table profiles enable row level security;
alter table friendships enable row level security;

-- Profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Friendship helper (security definer to avoid RLS recursion)
create or replace function public.is_friend_of(owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = auth.uid() and f.addressee_id = owner_id)
        or (f.addressee_id = auth.uid() and f.requester_id = owner_id)
      )
  );
$$;

-- Find user by exact email (for friend requests)
create or replace function public.find_profile_by_email(search_email text)
returns table (id uuid, email text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.display_name
  from profiles p
  where lower(p.email) = lower(trim(search_email))
    and p.id <> auth.uid()
  limit 1;
$$;

grant execute on function public.find_profile_by_email(text) to authenticated;
grant execute on function public.is_friend_of(uuid) to authenticated;

-- Profiles RLS
create policy "Users manage own profile"
  on profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Friends can read profiles"
  on profiles for select
  using (public.is_friend_of(id));

-- Friendships RLS
create policy "Users read own friendships"
  on friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

create policy "Users send friend requests"
  on friendships for insert
  with check (
    requester_id = auth.uid()
    and status = 'pending'
  );

create policy "Addressee responds to requests"
  on friendships for update
  using (addressee_id = auth.uid() and status = 'pending')
  with check (
    addressee_id = auth.uid()
    and status in ('accepted', 'rejected')
  );

create policy "Users delete own friendships"
  on friendships for delete
  using (
    requester_id = auth.uid()
    or addressee_id = auth.uid()
  );

-- Friends can read collection data (SELECT only)
create policy "Friends can read games"
  on games for select
  using (public.is_friend_of(user_id));

create policy "Friends can read consoles"
  on consoles for select
  using (public.is_friend_of(user_id));

create policy "Friends can read tags"
  on tags for select
  using (public.is_friend_of(user_id));

create policy "Friends can read game_tags"
  on game_tags for select
  using (
    exists (
      select 1 from games g
      where g.id = game_tags.game_id
        and public.is_friend_of(g.user_id)
    )
  );
