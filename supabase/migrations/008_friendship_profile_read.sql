-- Allow reading profiles of users involved in any friendship (pending, accepted, rejected)
create policy "Users read profiles in friendships"
  on profiles for select
  using (
    exists (
      select 1
      from friendships f
      where (
        f.requester_id = auth.uid() and f.addressee_id = profiles.id
      ) or (
        f.addressee_id = auth.uid() and f.requester_id = profiles.id
      )
    )
  );
