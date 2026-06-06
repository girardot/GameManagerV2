-- PEGI age rating (3, 7, 12, 16, 18)

alter table games
  add column pegi smallint check (pegi is null or pegi in (3, 7, 12, 16, 18));

alter table buy_list
  add column pegi smallint check (pegi is null or pegi in (3, 7, 12, 16, 18));

alter table play_queue
  add column pegi smallint check (pegi is null or pegi in (3, 7, 12, 16, 18));
