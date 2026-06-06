-- Personal rating (0–20)

alter table games
  add column rating smallint check (rating is null or (rating >= 0 and rating <= 20));

alter table buy_list
  add column rating smallint check (rating is null or (rating >= 0 and rating <= 20));

alter table play_queue
  add column rating smallint check (rating is null or (rating >= 0 and rating <= 20));
