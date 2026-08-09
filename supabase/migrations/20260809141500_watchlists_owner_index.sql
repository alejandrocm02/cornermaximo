create index if not exists user_watchlist_players_watchlist_owner_idx
  on public.user_watchlist_players (watchlist_id, user_id);
